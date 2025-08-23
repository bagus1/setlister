const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Setlist = sequelize.define(
    "Setlist",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          len: [1, 200],
        },
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
      date: {
        type: DataTypes.DATE,
      },
      isFinalized: {
        type: DataTypes.BOOLEAN,
        field: "is_finalized",
        defaultValue: false,
      },
      recordingsUrl: {
        type: DataTypes.TEXT,
        field: "recordings_url",
        allowNull: true,
      },
    },
    {
      tableName: "setlists",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return Setlist;
};
