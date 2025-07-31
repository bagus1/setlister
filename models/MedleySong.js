const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const MedleySong = sequelize.define('MedleySong', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        medleyId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'medleys',
                key: 'id'
            }
        },
        songId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'songs',
                key: 'id'
            }
        },
        order: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    }, {
        tableName: 'medley_songs',
        timestamps: true
    });

    return MedleySong;
}; 