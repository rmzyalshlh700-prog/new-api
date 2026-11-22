package console_setting

const (
	SocialLinksPositionSidebarBottom = "sidebar_bottom"
	SocialLinksPositionSidebarTop    = "sidebar_top"
	SocialLinksPositionFooter        = "footer"

	SocialIconSizeSmall  = "small"
	SocialIconSizeMedium = "medium"
	SocialIconSizeLarge  = "large"
)

// IsValidSocialLinksPosition reports whether the value names a placement the
// frontend knows how to render. "footer" hides the group from the sidebar.
func IsValidSocialLinksPosition(position string) bool {
	switch position {
	case SocialLinksPositionSidebarBottom, SocialLinksPositionSidebarTop, SocialLinksPositionFooter:
		return true
	default:
		return false
	}
}

// IsValidSocialIconSize reports whether the value names a supported icon size.
func IsValidSocialIconSize(size string) bool {
	switch size {
	case SocialIconSizeSmall, SocialIconSizeMedium, SocialIconSizeLarge:
		return true
	default:
		return false
	}
}

// SocialLinksPositionOrDefault returns the configured placement, falling back
// to the sidebar bottom when the stored value is empty or unknown.
func (s *ConsoleSetting) SocialLinksPositionOrDefault() string {
	if s != nil && IsValidSocialLinksPosition(s.SocialLinksPosition) {
		return s.SocialLinksPosition
	}
	return SocialLinksPositionSidebarBottom
}

// SocialIconSizeOrDefault returns the configured icon size, falling back to
// medium when the stored value is empty or unknown.
func (s *ConsoleSetting) SocialIconSizeOrDefault() string {
	if s != nil && IsValidSocialIconSize(s.SocialIconSize) {
		return s.SocialIconSize
	}
	return SocialIconSizeMedium
}
