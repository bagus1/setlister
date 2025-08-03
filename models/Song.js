const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Song = sequelize.define('Song', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                len: [1, 200]
            }
        },
        key: {
            type: DataTypes.ENUM(
                'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
                'Cm', 'C#m', 'Dbm', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm', 'F#m', 'Gbm', 'Gm', 'G#m', 'Abm', 'Am', 'A#m', 'Bbm', 'Bm'
            )
        },
        time: {
            type: DataTypes.INTEGER, // Time in seconds
            validate: {
                min: 0
            }
        },
        bpm: {
            type: DataTypes.INTEGER, // Beats per minute
            validate: {
                min: 40,
                max: 300
            }
        },
        vocalistId: {
            type: DataTypes.INTEGER,
            references: {
                model: 'vocalists',
                key: 'id'
            }
        }
    }, {
        tableName: 'songs',
        timestamps: true
    });

    return Song;
}; 