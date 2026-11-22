package controller

import (
	"net/http"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
)

// PublicBlogText holds the same editorial copy in every interface language the
// public site ships. English is the fallback the browser uses when a
// translation is left blank.
type PublicBlogText struct {
	En string `json:"en"`
	Ar string `json:"ar"`
	Ru string `json:"ru"`
}

// PublicBlogPost is one administrator-managed article. It is stored as JSON in
// the existing options store, so publishing a post needs no schema migration.
type PublicBlogPost struct {
	ID        string         `json:"id"`
	Slug      string         `json:"slug"`
	Date      string         `json:"date"`
	Published bool           `json:"published"`
	Title     PublicBlogText `json:"title"`
	Summary   PublicBlogText `json:"summary"`
	Body      PublicBlogText `json:"body"`
}

// publicPageEnabled reports whether an administrator left a public page
// switched on. The option map is read under the lock its callers already hold;
// an absent option means "visible", so a fresh installation exposes every page.
func publicPageEnabled(optionKey string) bool {
	value, ok := common.OptionMap[optionKey]
	if !ok {
		return true
	}
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "false", "0":
		return false
	default:
		return true
	}
}

func publicPagesStatus() gin.H {
	return gin.H{
		"docs":         publicPageEnabled("public_pages.docs_enabled"),
		"integrations": publicPageEnabled("public_pages.integrations_enabled"),
		"about":        publicPageEnabled("public_pages.about_enabled"),
		"blog":         publicPageEnabled("public_pages.blog_enabled"),
	}
}

func readPublicBlogPosts() ([]PublicBlogPost, error) {
	common.OptionMapRWMutex.RLock()
	raw := common.OptionMap["public_pages.blog_posts"]
	common.OptionMapRWMutex.RUnlock()

	if strings.TrimSpace(raw) == "" {
		return []PublicBlogPost{}, nil
	}

	posts := []PublicBlogPost{}
	if err := common.UnmarshalJsonStr(raw, &posts); err != nil {
		return nil, err
	}
	return posts, nil
}

// GetPublicBlogPosts serves the published editorial feed. Drafts never leave
// the administrator's console.
func GetPublicBlogPosts(c *gin.Context) {
	posts, err := readPublicBlogPosts()
	if err != nil {
		common.ApiErrorMsg(c, "invalid public blog configuration")
		return
	}

	published := make([]PublicBlogPost, 0, len(posts))
	for _, post := range posts {
		if post.Published {
			published = append(published, post)
		}
	}
	sort.SliceStable(published, func(i, j int) bool {
		return published[i].Date > published[j].Date
	})

	c.Header("Cache-Control", "no-cache")
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    published,
	})
}
