const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const SetlistSet = sequelize.define('SetlistSet', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        setlistId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'setlists',
                key: 'id'
            }
        },
        name: {
            type: DataTypes.ENUM('Set 1', 'Set 2', 'Set 3', 'Set 4', 'Maybe'),
            allowNull: false
        },
        order: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    }, {
        tableName: 'setlist_sets',
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['setlistId', 'name']
            }
        ]
    });

    return SetlistSet;
}; 