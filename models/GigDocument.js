const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const GigDocument = sequelize.define('GigDocument', {
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
        title: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                len: [1, 200]
            }
        },
        gigDate: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'Date of the gig'
        },
        venue: {
            type: DataTypes.STRING,
            allowNull: true,
            validate: {
                len: [0, 255]
            }
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Generated document content'
        },
        format: {
            type: DataTypes.ENUM('google-doc', 'markdown', 'html', 'pdf'),
            defaultValue: 'markdown',
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('draft', 'final', 'archived'),
            defaultValue: 'draft',
            allowNull: false
        },
        generatedAt: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        tableName: 'gig_documents',
        timestamps: true
    });

    return GigDocument;
};
