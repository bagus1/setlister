const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Vocalist = sequelize.define(
    "Vocalist",
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
    },
    {
      tableName: "vocalists",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return Vocalist;
};
