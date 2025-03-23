package controllers

import (
	"github.com/nbursa/decentralized-plenum/backend/config"
	"github.com/nbursa/decentralized-plenum/backend/models"

	"github.com/gofiber/fiber/v2"
)

type VoteSync struct {
  RoomID   string `json:"roomId"`
  Question string `json:"question"`
  Yes      int    `json:"yes"`
  No       int    `json:"no"`
  Total    int    `json:"total"`
  Username string `json:"username"`
}

func SyncVotes(c *fiber.Ctx) error {
  var input []VoteSync
  if err := c.BodyParser(&input); err != nil {
    return c.Status(400).JSON(fiber.Map{"error": "Invalid input"})
  }

  for _, v := range input {
    vote := models.Vote{
      RoomID:   v.RoomID,
      Question: v.Question,
      Yes:      v.Yes,
      No:       v.No,
      Total:    v.Total,
      Username: v.Username,
    }
    config.DB.Create(&vote)
  }

  return c.JSON(fiber.Map{"message": "Votes synced successfully"})
}
