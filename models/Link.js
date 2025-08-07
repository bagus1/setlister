const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Link = sequelize.define('Link', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        songId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'songs',
                key: 'id'
            }
        },
        type: {
            type: DataTypes.ENUM('youtube', 'spotify', 'apple-music', 'soundcloud', 'bandcamp', 'lyrics', 'tab', 'bass tab', 'chords', 'guitar tutorial', 'bass tutorial', 'keyboard tutorial', 'audio', 'sheet-music', 'backing-track', 'karaoke', 'horn chart', 'other'),
            allowNull: false,
            validate: {
                notEmpty: true
            }
        },
        description: {
            type: DataTypes.STRING,
            allowNull: true,
            validate: {
                len: [0, 255]
            }
        },
        url: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                notEmpty: true,
                isUrl: true
            }
        }
    }, {
        tableName: 'links',
        timestamps: true
    });

    return Link;
}; 