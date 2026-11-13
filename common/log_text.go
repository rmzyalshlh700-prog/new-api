package common

import (
	_ "embed"
	"fmt"
	"strings"
)

// Server log lines are English. logTextAr and logTextRu hold the Arabic and
// Russian text of the lines that have one, keyed by their English format.
//
//go:embed log_text.ar.json
var logTextAr []byte

//go:embed log_text.ru.json
var logTextRu []byte

// logTexts is the translation table DEFAULT_LANGUAGE selected; nil prints English.
var logTexts map[string]string

// SetLogLanguage selects the language of server log lines. Arabic and Russian
// print their own text; anything else prints English.
func SetLogLanguage(language string) {
	logTexts = nil
	lang := strings.ToLower(strings.TrimSpace(language))
	switch {
	case strings.HasPrefix(lang, "ar"):
		_ = Unmarshal(logTextAr, &logTexts)
	case strings.HasPrefix(lang, "ru"):
		_ = Unmarshal(logTextRu, &logTexts)
	}
}

// LogText formats a server log line in the language of DEFAULT_LANGUAGE. format is
// the English text and the key of its translation in log_text.ar.json and
// log_text.ru.json.
func LogText(format string, args ...any) string {
	if translated, ok := logTexts[format]; ok {
		return fmt.Sprintf(translated, args...)
	}
	return fmt.Sprintf(format, args...)
}
