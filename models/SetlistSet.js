const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const SetlistSet = sequelize.define(
    "SetlistSet",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      setlistId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "setlist_id",
        references: {
          model: "setlists",
          key: "id",
        },
      },
      name: {
        type: DataTypes.ENUM("Set 1", "Set 2", "Set 3", "Set 4", "Maybe"),
        allowNull: false,
      },
      order: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      tableName: "setlist_sets",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        {
          unique: true,
          fields: ["setlist_id", "name"],
        },
      ],
    }
  );

  return SetlistSet;
};
