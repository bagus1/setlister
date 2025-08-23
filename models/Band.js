const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Band = sequelize.define(
    "Band",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          len: [1, 100],
        },
      },
      description: {
        type: DataTypes.TEXT,
      },
      createdById: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "created_by_id",
        references: {
          model: "users",
          key: "id",
        },
      },
    },
    {
      tableName: "bands",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return Band;
};
