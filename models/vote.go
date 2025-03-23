package models

type Vote struct {
  ID        uint   `gorm:"primaryKey"`
  RoomID    string
  Question  string
  Yes       int
  No        int
  Total     int
  Username  string
}
