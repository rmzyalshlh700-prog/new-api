package setting

import (
	"errors"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

const (
	ContactLinkPositionSidebarBottom = "sidebar_bottom"
	ContactLinkPositionSidebarTop    = "sidebar_top"
	ContactLinkPositionHeaderTop     = "header_top"
	ContactLinkPositionFooter        = "footer"
)

// ContactLink is a single social/contact entry rendered dynamically in the
// client UI. The full list is stored as a JSON array in the "ContactLinks"
// option (portable across SQLite/MySQL/PostgreSQL, no schema change).
type ContactLink struct {
	Id       string `json:"id"`
	Title    string `json:"title"`
	Url      string `json:"url"`
	Icon     string `json:"icon"`
	Position string `json:"position"`
	IsActive bool   `json:"is_active"`
}

var contactLinkPositions = map[string]bool{
	ContactLinkPositionSidebarBottom: true,
	ContactLinkPositionSidebarTop:    true,
	ContactLinkPositionHeaderTop:     true,
	ContactLinkPositionFooter:        true,
}

func IsValidContactLinkPosition(position string) bool {
	return contactLinkPositions[position]
}

func GetContactLinks() []ContactLink {
	common.OptionMapRWMutex.RLock()
	jsonStr := common.OptionMap["ContactLinks"]
	common.OptionMapRWMutex.RUnlock()

	if jsonStr == "" {
		return []ContactLink{}
	}
	var links []ContactLink
	if err := common.UnmarshalJsonStr(jsonStr, &links); err != nil {
		return []ContactLink{}
	}
	return links
}

// ValidateContactLink checks one entry before it may be persisted.
func ValidateContactLink(link ContactLink) error {
	if strings.TrimSpace(link.Title) == "" {
		return errors.New("contact link title is required")
	}
	if len(link.Title) > 100 {
		return errors.New("contact link title is too long")
	}
	parsed, err := url.Parse(strings.TrimSpace(link.Url))
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return errors.New("contact link url must be a valid http(s) url")
	}
	if len(link.Url) > 500 {
		return errors.New("contact link url is too long")
	}
	if len(link.Icon) > 64 {
		return errors.New("contact link icon name is too long")
	}
	if !IsValidContactLinkPosition(link.Position) {
		return errors.New("invalid contact link position")
	}
	return nil
}

// SetContactLinks validates the whole list, serializes it and stores it in
// the in-memory option map. Persisting to the database is done by the
// caller through model.UpdateOption.
func SetContactLinks(links []ContactLink) error {
	for _, link := range links {
		if err := ValidateContactLink(link); err != nil {
			return err
		}
	}
	if links == nil {
		links = []ContactLink{}
	}
	jsonBytes, err := common.Marshal(links)
	if err != nil {
		return err
	}
	common.OptionMapRWMutex.Lock()
	common.OptionMap["ContactLinks"] = string(jsonBytes)
	common.OptionMapRWMutex.Unlock()
	return nil
}
