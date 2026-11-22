package service

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPinnedDialerBlocksReboundInternalAddress(t *testing.T) {
	var dialed []string
	dialer := &pinnedDialer{
		dialer: &net.Dialer{},
		resolver: staticSSRFResolver{
			"rebind.example": {{IP: net.ParseIP("127.0.0.1")}},
		},
		dialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			dialed = append(dialed, address)
			return testConn(t), nil
		},
	}

	conn, err := dialer.DialContext(context.Background(), "tcp", "rebind.example:443")

	require.Error(t, err)
	require.Nil(t, conn)
	assert.Contains(t, err.Error(), "blocked internal network address")
	assert.Empty(t, dialed)
}

func TestPinnedDialerRejectsMixedResolvedAddresses(t *testing.T) {
	var dialed []string
	dialer := &pinnedDialer{
		dialer: &net.Dialer{},
		resolver: staticSSRFResolver{
			"rebind.example": {
				{IP: net.ParseIP("8.8.8.8")},
				{IP: net.ParseIP("10.0.0.1")},
			},
		},
		dialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			dialed = append(dialed, address)
			return testConn(t), nil
		},
	}

	conn, err := dialer.DialContext(context.Background(), "tcp", "rebind.example:443")

	require.Error(t, err)
	require.Nil(t, conn)
	assert.Contains(t, err.Error(), "blocked internal network address")
	assert.Empty(t, dialed)
}

func TestPinnedDialerConnectsToTheResolvedAddress(t *testing.T) {
	var dialed []string
	dialer := &pinnedDialer{
		dialer: &net.Dialer{},
		resolver: staticSSRFResolver{
			"public.example": {{IP: net.ParseIP("8.8.8.8")}},
		},
		dialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			dialed = append(dialed, address)
			return testConn(t), nil
		},
	}

	conn, err := dialer.DialContext(context.Background(), "tcp", "public.example:443")

	require.NoError(t, err)
	require.NotNil(t, conn)
	assert.Equal(t, []string{"8.8.8.8:443"}, dialed)
}

func TestPinnedDialerAllowsInternalAddressWhenAuthorized(t *testing.T) {
	var dialed []string
	dialer := &pinnedDialer{
		dialer: &net.Dialer{},
		resolver: staticSSRFResolver{
			"internal.example": {{IP: net.ParseIP("10.0.0.1")}},
		},
		allowPrivateNetwork: true,
		dialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			dialed = append(dialed, address)
			return testConn(t), nil
		},
	}

	conn, err := dialer.DialContext(context.Background(), "tcp", "internal.example:80")

	require.NoError(t, err)
	require.NotNil(t, conn)
	assert.Equal(t, []string{"10.0.0.1:80"}, dialed)
}

func TestPinnedDialerSkipsTheCheckForProxiedConnections(t *testing.T) {
	var dialed []string
	dialer := &pinnedDialer{
		dialer: &net.Dialer{},
		resolver: staticSSRFResolver{
			"proxy.internal": {{IP: net.ParseIP("10.0.0.1")}},
		},
		dialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			dialed = append(dialed, address)
			return testConn(t), nil
		},
	}

	ctx := context.WithValue(context.Background(), proxyDialKey{}, true)
	conn, err := dialer.DialContext(ctx, "tcp", "proxy.internal:3128")

	require.NoError(t, err)
	require.NotNil(t, conn)
	assert.Equal(t, []string{"proxy.internal:3128"}, dialed)
}

func TestProxyFromEnvironmentMarksProxiedRequests(t *testing.T) {
	request, err := http.NewRequest(http.MethodGet, "http://upstream.example/resource", nil)
	require.NoError(t, err)

	proxyURL, err := proxyFromEnvironment(request)
	require.NoError(t, err)

	marked, _ := request.Context().Value(proxyDialKey{}).(bool)
	if proxyURL != nil {
		assert.True(t, marked, "a request that uses a proxy must be marked for the dialer")
		return
	}
	assert.False(t, marked, "a request without a proxy must not be marked for the dialer")
}

func TestMarkProxyDialRequestMarksTheRequestContext(t *testing.T) {
	request, err := http.NewRequest(http.MethodGet, "http://upstream.example/resource", nil)
	require.NoError(t, err)

	markProxyDialRequest(request)

	marked, ok := request.Context().Value(proxyDialKey{}).(bool)
	assert.True(t, ok)
	assert.True(t, marked)
}

// The transport marks a request that goes through a proxy, so the dialer does
// not apply the target check to the proxy connection: the proxy resolves the
// target host itself.
func TestRelayTransportDialsTheProxyWithoutTheTargetCheck(t *testing.T) {
	var dialed []string
	transport := newRelayHTTPTransport()
	transport.DialContext = (&pinnedDialer{
		dialer: &net.Dialer{},
		resolver: staticSSRFResolver{
			"proxy.internal": {{IP: net.ParseIP("10.0.0.1")}},
		},
		dialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			dialed = append(dialed, address)
			return nil, errors.New("stop after the proxy dial")
		},
	}).DialContext
	transport.Proxy = func(req *http.Request) (*url.URL, error) {
		proxyURL, err := url.Parse("http://proxy.internal:3128")
		if err != nil {
			return nil, err
		}
		markProxyDialRequest(req)
		return proxyURL, nil
	}

	request, err := http.NewRequest(http.MethodGet, "http://upstream.example/resource", nil)
	require.NoError(t, err)

	_, err = transport.RoundTrip(request)

	require.Error(t, err)
	assert.Equal(t, []string{"proxy.internal:3128"}, dialed)
}

// A literal internal address must be refused at the dial time, exactly like an
// internal address resolved from a name. Before this guard the dialer only
// warned and connected, so the last enforcement point depended on every caller
// having run the pre-flight validation first.
func TestPinnedDialerBlocksLiteralInternalAddress(t *testing.T) {
	var dialed []string
	dialer := &pinnedDialer{
		dialer:   &net.Dialer{},
		resolver: staticSSRFResolver{},
		dialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			dialed = append(dialed, address)
			return testConn(t), nil
		},
	}

	for _, address := range []string{
		"127.0.0.1:8080",
		"10.1.2.3:5432",
		"172.16.0.9:2375",
		"192.168.1.1:80",
		"[::1]:9000",
	} {
		conn, err := dialer.DialContext(context.Background(), "tcp", address)

		require.Error(t, err, address)
		require.Nil(t, conn, address)
		assert.Contains(t, err.Error(), "blocked internal network address", address)
	}
	assert.Empty(t, dialed, "no internal literal address may be dialed")
}

// Root-configured channels that are explicitly allowed to reach the internal
// network must keep working with a literal address, or internal upstreams break.
func TestPinnedDialerAllowsLiteralInternalAddressWhenAuthorized(t *testing.T) {
	var dialed []string
	dialer := &pinnedDialer{
		dialer:              &net.Dialer{},
		resolver:            staticSSRFResolver{},
		allowPrivateNetwork: true,
		dialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			dialed = append(dialed, address)
			return testConn(t), nil
		},
	}

	conn, err := dialer.DialContext(context.Background(), "tcp", "10.0.0.5:11434")

	require.NoError(t, err)
	require.NotNil(t, conn)
	assert.Equal(t, []string{"10.0.0.5:11434"}, dialed)
}

// A public literal address is not affected by the guard.
func TestPinnedDialerAllowsPublicLiteralAddress(t *testing.T) {
	var dialed []string
	dialer := &pinnedDialer{
		dialer:   &net.Dialer{},
		resolver: staticSSRFResolver{},
		dialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			dialed = append(dialed, address)
			return testConn(t), nil
		},
	}

	conn, err := dialer.DialContext(context.Background(), "tcp", "8.8.8.8:443")

	require.NoError(t, err)
	require.NotNil(t, conn)
	assert.Equal(t, []string{"8.8.8.8:443"}, dialed)
}
