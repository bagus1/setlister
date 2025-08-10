const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const BandSong = sequelize.define('BandSong', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        bandId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'bands',
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
        gigDocumentId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'gig_documents',
                key: 'id'
            },
            comment: 'Preferred gig document for this band/song combination'
        }
    }, {
        tableName: 'band_songs',
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['bandId', 'songId']
            }
        ]
    });

    return BandSong;
}; 