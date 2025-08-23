const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const BandInvitation = sequelize.define(
    "BandInvitation",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      bandId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "band_id",
        references: {
          model: "bands",
          key: "id",
        },
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isEmail: true,
        },
      },
      token: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      role: {
        type: DataTypes.ENUM("member"),
        defaultValue: "member",
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "expires_at",
      },
      usedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "used_at",
      },
      invitedBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "invited_by",
        references: {
          model: "users",
          key: "id",
        },
      },
    },
    {
      tableName: "band_invitations",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return BandInvitation;
};
