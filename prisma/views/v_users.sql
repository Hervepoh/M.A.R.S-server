CREATE OR REPLACE VIEW v_users AS
SELECT
    u.id,
    u.name,
    u.email,
    u.phone,
    u.ldap,
    CASE
        WHEN u.isActive = 0 THEN 'inactive'
        ELSE 'active'
    END AS status,
    u.isActive,
    u.deleted,
    u.deletedAt,
    GROUP_CONCAT(r.name SEPARATOR ', ') AS roles,
    ut.name AS unit,
    u.createdAt,
    u.updatedAt
FROM
    users u
    LEFT JOIN user_roles ur ON u.id = ur.userId
    LEFT JOIN roles r ON r.id = ur.roleId
    LEFT JOIN units ut ON ut.id = u.unitId
WHERE u.deleted = 0
GROUP BY
    u.id,
    u.name,
    u.email,
    u.phone,
    u.ldap,
    ut.name
ORDER BY
    u.createdAt DESC;