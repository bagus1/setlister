const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const PasswordReset = sequelize.define('PasswordReset', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
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
        expiresAt: {
            type: DataTypes.DATE,
            allowNull: false
        },
        usedAt: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        tableName: 'password_resets',
        timestamps: true
    });

    return PasswordReset;
}; 