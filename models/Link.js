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
            type: DataTypes.ENUM('youtube', 'spotify', 'apple-music', 'soundcloud', 'bandcamp', 'lyrics', 'tab', 'bass tab', 'chords', 'guitar tutorial', 'bass tutorial', 'keyboard tutorial', 'audio', 'sheet-music', 'backing-track', 'karaoke', 'horn chart', 'google-doc', 'document', 'other'),
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
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Stored document content for songs with chords/lyrics'
        },
        format: {
            type: DataTypes.ENUM('google-doc', 'markdown', 'html', 'plain-text'),
            allowNull: true,
            comment: 'Format of stored content'
        },
        pageBreaks: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            comment: 'Whether to add page breaks when printing'
        }
    }, {
        tableName: 'links',
        timestamps: true
    });

    return Link;
}; 