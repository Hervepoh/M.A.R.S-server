CREATE OR REPLACE VIEW v_users_id AS
SELECT
    u.id,
    u.name,
    u.email,
    u.ldap,
    u.password,
    u.isActive,
    u.deleted,
    GROUP_CONCAT(r.id SEPARATOR ', ') AS roleId,
    ut.id AS unitId
FROM
    users u
    LEFT JOIN user_roles ur ON u.id = ur.userId
    LEFT JOIN roles r ON r.id = ur.roleId
    LEFT JOIN units ut ON ut.id = u.unitId
GROUP BY
    u.id,
    u.name,
    u.email,
    u.ldap,
    u.password,
    u.deleted,
    ut.id
ORDER BY
    u.createdAt DESC;