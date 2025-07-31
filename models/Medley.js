const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Medley = sequelize.define('Medley', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
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
        vocalistId: {
            type: DataTypes.INTEGER,
            references: {
                model: 'vocalists',
                key: 'id'
            }
        }
    }, {
        tableName: 'medleys',
        timestamps: true
    });

    return Medley;
}; 