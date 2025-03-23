package models

type Room struct {
	ID       string `gorm:"primaryKey"`
	HostID   string
	Host     User `gorm:"foreignKey:HostID"`
}
