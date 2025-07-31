const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const BandMember = sequelize.define('BandMember', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        bandId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'bands',
                key: 'id'
            }
        },
        role: {
            type: DataTypes.ENUM('owner', 'member'),
            defaultValue: 'member'
        }
    }, {
        tableName: 'band_members',
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['userId', 'bandId']
            }
        ]
    });

    return BandMember;
}; 