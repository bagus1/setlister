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
        defaultValue: false,
      },
      recordingsUrl: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "setlists",
      timestamps: true,
    }
  );

  return Setlist;
};
