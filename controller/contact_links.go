package controller

import (
	"github.com/google/uuid"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
)

// The contact links list is stored as a JSON array in the single
// "ContactLinks" option; these endpoints implement CRUD on that list.
// Writes go through setting.SetContactLinks (validation) followed by
// model.UpdateOption (persistence + cache refresh).

func GetContactLinksAdmin(c *gin.Context) {
	common.ApiSuccess(c, setting.GetContactLinks())
}

type AddContactLinkRequest struct {
	Title    string `json:"title"`
	Url      string `json:"url"`
	Icon     string `json:"icon"`
	Position string `json:"position"`
	IsActive bool   `json:"is_active"`
}

func AddContactLink(c *gin.Context) {
	var req AddContactLinkRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}

	link := setting.ContactLink{
		Id:       uuid.NewString(),
		Title:    req.Title,
		Url:      req.Url,
		Icon:     req.Icon,
		Position: req.Position,
		IsActive: req.IsActive,
	}
	if err := appendContactLink(link); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, link)
}

type UpdateContactLinkRequest struct {
	Id       string  `json:"id"`
	Title    *string `json:"title"`
	Url      *string `json:"url"`
	Icon     *string `json:"icon"`
	Position *string `json:"position"`
	IsActive *bool   `json:"is_active"`
}

func UpdateContactLink(c *gin.Context) {
	var req UpdateContactLinkRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.Id == "" {
		common.ApiErrorMsg(c, "contact link id is required")
		return
	}

	links := setting.GetContactLinks()
	updated := false
	for i := range links {
		if links[i].Id != req.Id {
			continue
		}
		if req.Title != nil {
			links[i].Title = *req.Title
		}
		if req.Url != nil {
			links[i].Url = *req.Url
		}
		if req.Icon != nil {
			links[i].Icon = *req.Icon
		}
		if req.Position != nil {
			links[i].Position = *req.Position
		}
		if req.IsActive != nil {
			links[i].IsActive = *req.IsActive
		}
		updated = true
		break
	}
	if !updated {
		common.ApiErrorMsg(c, "contact link not found")
		return
	}

	if err := persistContactLinks(links); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, links)
}

func DeleteContactLink(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		common.ApiErrorMsg(c, "contact link id is required")
		return
	}

	links := setting.GetContactLinks()
	remaining := make([]setting.ContactLink, 0, len(links))
	deleted := false
	for _, link := range links {
		if link.Id == id {
			deleted = true
			continue
		}
		remaining = append(remaining, link)
	}
	if !deleted {
		common.ApiErrorMsg(c, "contact link not found")
		return
	}

	if err := persistContactLinks(remaining); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, remaining)
}

// GetPublicContactLinks returns the active links for rendering in the
// client UI. It is a public, anonymous endpoint.
func GetPublicContactLinks(c *gin.Context) {
	links := setting.GetContactLinks()
	active := make([]setting.ContactLink, 0, len(links))
	for _, link := range links {
		if link.IsActive {
			active = append(active, link)
		}
	}
	common.ApiSuccess(c, active)
}

func appendContactLink(link setting.ContactLink) error {
	links := append(setting.GetContactLinks(), link)
	return persistContactLinks(links)
}

func persistContactLinks(links []setting.ContactLink) error {
	if err := setting.SetContactLinks(links); err != nil {
		return err
	}
	common.OptionMapRWMutex.RLock()
	jsonStr := common.OptionMap["ContactLinks"]
	common.OptionMapRWMutex.RUnlock()
	return model.UpdateOption("ContactLinks", jsonStr)
}
