package service

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Isolated F4 validation: a loopback stub stands in for an internal service.
// The pre-flight check already refuses it; the point of this test is that the
// protected transport now refuses it too, so a call site that forgets the
// pre-flight check cannot reach the internal network.
func TestProtectedClientRefusesLiteralLoopbackAtDialTime(t *testing.T) {
	var hits int
	stub := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits++
		w.WriteHeader(http.StatusOK)
	}))
	defer stub.Close()

	// A transport built exactly as the application builds its protected one,
	// but driven directly so no pre-flight validation runs: this isolates the
	// dial-time decision, which is what F4 is about.
	transport := &http.Transport{}
	applyPinnedDialer(transport, false)
	client := &http.Client{Transport: transport}
	resp, err := client.Get(stub.URL)

	require.Error(t, err, "the dial-time guard must refuse a literal loopback address")
	if resp != nil {
		resp.Body.Close()
	}
	assert.Contains(t, err.Error(), "blocked internal network address")
	assert.Zero(t, hits, "the internal stub must never be reached")
}

// The same request through the ordinary (non-SSRF) client still works, which
// proves the refusal above comes from the guard and not from the stub.
func TestOrdinaryClientReachesLiteralLoopback(t *testing.T) {
	var hits int
	stub := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits++
		w.WriteHeader(http.StatusOK)
	}))
	defer stub.Close()

	resp, err := (&http.Client{}).Get(stub.URL)
	require.NoError(t, err)
	resp.Body.Close()
	assert.Equal(t, 1, hits)
}

// The exported download path refuses the same target through its pre-flight
// check, so both layers agree.
func TestDoDownloadRequestRefusesLiteralLoopback(t *testing.T) {
	stub := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer stub.Close()

	resp, err := DoDownloadRequest(stub.URL, "f4 validation")

	require.Error(t, err)
	if resp != nil {
		resp.Body.Close()
	}
}
