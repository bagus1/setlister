const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const BandInvitation = sequelize.define('BandInvitation', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        bandId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'Bands',
                key: 'id'
            }
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                isEmail: true
            }
        },
        token: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        role: {
            type: DataTypes.ENUM('member'),
            defaultValue: 'member'
        },
        expiresAt: {
            type: DataTypes.DATE,
            allowNull: false
        },
        usedAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        invitedBy: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id'
            }
        }
        }, {
        tableName: 'BandInvitations',
        timestamps: true
    });

    return BandInvitation;
}; 