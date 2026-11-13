package i18n

import (
	"embed"
	"go/ast"
	"go/parser"
	"go/token"
	"net/http/httptest"
	"slices"
	"strconv"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/nicksnyder/go-i18n/v2/i18n"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/text/language"
	"gopkg.in/yaml.v3"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
)

// declaredMessageKeys parses keys.go and returns its message-key constants.
func declaredMessageKeys(t *testing.T) []string {
	t.Helper()
	keysFile, err := parser.ParseFile(token.NewFileSet(), "keys.go", nil, parser.SkipObjectResolution)
	require.NoError(t, err)
	var declared []string
	ast.Inspect(keysFile, func(node ast.Node) bool {
		if spec, ok := node.(*ast.ValueSpec); ok {
			for _, value := range spec.Values {
				if literal, ok := value.(*ast.BasicLit); ok {
					key, err := strconv.Unquote(literal.Value)
					require.NoError(t, err)
					declared = append(declared, key)
				}
			}
		}
		return true
	})
	slices.Sort(declared)
	return declared
}

// loadTestBundle loads the embedded locales for assertions on their contents.
func loadTestBundle(t *testing.T) *i18n.Bundle {
	t.Helper()
	b := i18n.NewBundle(language.English)
	b.RegisterUnmarshalFunc("yaml", yaml.Unmarshal)
	for _, f := range []string{"locales/en.yaml", "locales/ar.yaml", "locales/ru.yaml"} {
		_, err := b.LoadMessageFileFS(testLocaleFS, f)
		require.NoError(t, err, "load %s", f)
	}
	return b
}

// TestLocalesRenderEveryKey asserts that every supported language has a
// translation file with exactly the declared keys, and that each translation
// renders every parameterized key without leftover placeholders.
func TestLocalesRenderEveryKey(t *testing.T) {
	b := loadTestBundle(t)
	declared := declaredMessageKeys(t)

	for _, lang := range SupportedLanguages() {
		data, err := testLocaleFS.ReadFile("locales/" + lang + ".yaml")
		require.NoError(t, err)
		var messages map[string]string
		require.NoError(t, yaml.Unmarshal(data, &messages))
		keys := make([]string, 0, len(messages))
		for key := range messages {
			keys = append(keys, key)
		}
		slices.Sort(keys)
		assert.Equal(t, declared, keys, "%s: locale keys must match declared message keys exactly", lang)

		localizer := i18n.NewLocalizer(b, lang)
		for _, key := range declared {
			msg, err := localizer.Localize(&i18n.LocalizeConfig{MessageID: key})
			require.NoError(t, err, "%s: localize %s", lang, key)
			assert.NotContains(t, msg, "{{", "%s: %s renders with leftover placeholders", lang, key)
		}
	}
}

// TestTranslationValues verifies a few representative translations per
// language, so a broken locale file fails with a readable diff.
func TestTranslationValues(t *testing.T) {
	b := loadTestBundle(t)

	cases := []struct {
		lang string
		key  string
		want string
	}{
		{LangEn, "common.database_error", "Database error, please contact the administrator"},
		{LangEn, "auth.user_banned", "User has been banned"},
		{LangAr, "auth.user_banned", "تم حظر المستخدم"},
		{LangAr, "token.invalid", "رمز غير صالح"},
		{LangRu, "auth.user_banned", "Пользователь заблокирован"},
		{LangRu, "token.invalid", "Недействительный токен"},
	}
	for _, tc := range cases {
		msg, err := i18n.NewLocalizer(b, tc.lang).Localize(&i18n.LocalizeConfig{MessageID: tc.key})
		require.NoError(t, err, "%s: %s", tc.lang, tc.key)
		assert.Equal(t, tc.want, msg, "%s: %s", tc.lang, tc.key)
	}
}

func TestLanguageFromUserSetting(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name     string
		language string
		expected string
	}{
		{"empty language means no statement", "", ""},
		{"en normalized", "en", LangEn},
		{"en-US normalized", "en-US", LangEn},
		{"ar normalized", "ar", LangAr},
		{"ar-EG normalized", "ar-EG", LangAr},
		{"ru normalized", "ru", LangRu},
		{"ru-RU normalized", "ru-RU", LangRu},
		{"unsupported language falls back to en", "fr", LangEn},
		{"unknown language falls back to en", "xx", LangEn},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest("GET", "/", nil)
			setting := dto.UserSetting{Language: tt.language}
			c.Set(string(constant.ContextKeyUserSetting), setting)

			got := StatedLang(c)
			assert.Equal(t, tt.expected, got)
		})
	}
}

func TestParseAcceptLanguage(t *testing.T) {
	tests := []struct {
		header   string
		expected string
	}{
		{"", ""},
		{"*", ""},
		{"en", LangEn},
		{"en-US,en;q=0.9", LangEn},
		{"ar;q=0.9", LangAr},
		{"ru-RU,ru;q=0.8,en;q=0.6", LangRu},
		{"fr", LangEn},
	}
	for _, tt := range tests {
		assert.Equal(t, tt.expected, ParseAcceptLanguage(tt.header), "header %q", tt.header)
	}
}

func TestIsSupported(t *testing.T) {
	assert.True(t, IsSupported("en"))
	assert.True(t, IsSupported("ar"))
	assert.True(t, IsSupported("ru"))
	assert.True(t, IsSupported("en-US"))
	assert.True(t, IsSupported("ru-RU"))
	assert.False(t, IsSupported("zh-CN"))
	assert.False(t, IsSupported("fr"))
	assert.False(t, IsSupported(""))
}

func TestSupportedLanguages(t *testing.T) {
	langs := SupportedLanguages()
	assert.Equal(t, []string{LangEn, LangAr, LangRu}, langs)
}

// testLocaleFS mirrors the production embed for tests.
//
//go:embed locales/*.yaml
var testLocaleFS embed.FS

func TestDeclaredKeysSorted(t *testing.T) {
	assert.True(t, slices.IsSorted(declaredMessageKeys(t)), "message keys must be sorted")
}

func TestBackendMessageLanguage(t *testing.T) {
	require.NoError(t, Init())

	tests := []struct {
		lang string
		key  string
		want string
	}{
		{LangEn, "auth.user_banned", "User has been banned"},
		{LangAr, "auth.user_banned", "تم حظر المستخدم"},
		{LangRu, "auth.user_banned", "Пользователь заблокирован"},
	}
	for _, tt := range tests {
		assert.Equal(t, tt.want, Translate(tt.lang, tt.key), "lang %s key %s", tt.lang, tt.key)
	}
	// Unsupported language falls back to the default language (en)
	assert.Equal(t, "User has been banned", Translate("zh-CN", "auth.user_banned"))
}
