const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const SetlistSong = sequelize.define('SetlistSong', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        setlistSetId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'setlist_sets',
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
        tableName: 'setlist_songs',
        timestamps: true
    });

    return SetlistSong;
}; 