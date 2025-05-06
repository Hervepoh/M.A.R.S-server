CREATE
OR REPLACE VIEW v_transaction_integration_documents AS
SELECT
    id.transactionId,
    id.reference,
    id.transaction_id,
    id.bill_account_number,
    id.bill_number,
    td.date AS billingDate,
    t.name AS customerName,
    id.paid_amount,
    id.paid_date,
    GREATEST (td.amountTopaid - td.amountUnpaid, 0) AS advancePayment
FROM
    integration_documents id
    JOIN transaction_details td ON id.transactionDetailsId = td.id
    JOIN transactions t ON id.transactionId = t.id;

----------------------------------------- 
-- View all transactions
-----------------------------------------
CREATE
OR REPLACE VIEW v_transactions AS
SELECT
    t.id,
    t.reference,
    t.name,
    t.amount,
    t.bankId,
    b.name bank,
    t.branchId,
    br.name branch,
    br.town town,
    t.paymentDate,
    t.paymentModeId,
    p.name paymentMode,
    t.description,
    t.statusId,
    s.name status,
    advice_duplication,
    t.validatorId,
    uv.name validator,
    t.validatedAt,
    t.assignBy,
    ua.name assignator,
    t.assignAt,
    t.verifierBy,
    uve.name verificator,
    t.verifierAt,
    t.refusal,
    t.reasonForRefusal,
    t.userId,
    uu.name user,
    t.regionId,
    regions.name region,
    t.unitId,
    units.name unit,
    t.createdBy,
    ucre.name as creator,
    t.created_at as createdAt,
    umod.name as modificator,
    t.updated_at as updatedAt
FROM
    transactions t
    LEFT JOIN status s ON t.statusId = s.id
    LEFT JOIN banks b ON t.bankId = b.id
    LEFT JOIN bank_agencies br ON t.branchId = br.id
    LEFT JOIN payment_modes p ON t.paymentModeId = p.id
    LEFT JOIN users uv ON t.validatorId = uv.id
    LEFT JOIN users ua ON t.assignBy = ua.id
    LEFT JOIN users uve ON t.assignBy = uve.id
    LEFT JOIN users uu ON t.userId = uu.id
    LEFT JOIN users ucre ON t.createdBy = ucre.id
    LEFT JOIN users umod ON t.modifiedBy = umod.id
    LEFT JOIN regions ON t.regionId = regions.id
    LEFT JOIN units ON t.unitId = units.id;

----------------------------------------- 
-- View all transactions to assign
-----------------------------------------
CREATE
OR REPLACE VIEW v_transactions_to_assign AS
SELECT
    t.id,
    t.reference,
    t.name,
    t.amount,
    b.name AS bank,
    br.name AS branch,
    br.town AS town,
    t.paymentDate,
    p.name AS paymentMode,
    t.description,
    s.name AS status
FROM
    transactions t
    LEFT JOIN status s ON t.statusId = s.id
    LEFT JOIN banks b ON t.bankId = b.id
    LEFT JOIN bank_agencies br ON t.branchId = br.id
    LEFT JOIN payment_modes p ON t.paymentModeId = p.id
WHERE
    t.statusId = 4
    AND t.reference NOT IN (
        SELECT
            reference
        FROM
            assignments
        WHERE
            deleted = 0
            AND status IN ('PENDING', 'VALIDATE')
    );

----------------------------------------- 
-- View all transactions that can be unassign
-----------------------------------------
CREATE
OR REPLACE VIEW V_transactions_eligible_for_unassignment AS
SELECT
    t.id,
    s.name AS status,
    t.reference,
    t.paymentDate,
    t.name,
    t.amount,
    b.name AS bank,
    br.name AS branch,
    p.name AS paymentMode,
    t.description,
    regions.name region,
    units.name unit,
    uu.name user
FROM
    transactions t
    LEFT JOIN status s ON t.statusId = s.id
    LEFT JOIN banks b ON t.bankId = b.id
    LEFT JOIN bank_agencies br ON t.branchId = br.id
    LEFT JOIN payment_modes p ON t.paymentModeId = p.id
    LEFT JOIN regions ON t.regionId = regions.id
    LEFT JOIN units ON t.unitId = units.id
    LEFT JOIN users uu ON t.userId = uu.id
WHERE
    t.statusId = 6
    AND t.id NOT IN (
        SELECT
            transactionId
        FROM
            transaction_details
        WHERE
            deleted = 0
    );

----------------------------------------- 
-- View all available transactions  
-----------------------------------------
CREATE
OR REPLACE VIEW v_transactions_available AS
SELECT
    t.id,
    t.reference,
    t.name,
    t.amount,
    b.name bank,
    t.branchId,
    br.name branch,
    br.town town,
    t.paymentDate,
    p.name paymentMode,
    t.description,
    t.statusId,
    s.name status,
    isReceiptReady,
    uv.name validator,
    t.validatedAt,
    ua.name assignator,
    t.assignAt,
    uve.name verificator,
    t.verifierAt,
    t.refusal,
    t.advice_duplication as adviceDuplication,
    t.reasonForRefusal,
    t.userId,
    uu.name assignTo,
    regions.name region,
    units.name unit,
    t.createdBy,
    ucre.name as creator,
    t.created_at as createdAt,
    umod.name as modificator,
    t.updated_at as updatedAt
FROM
    transactions t
    LEFT JOIN status s ON t.statusId = s.id
    LEFT JOIN banks b ON t.bankId = b.id
    LEFT JOIN bank_agencies br ON t.branchId = br.id
    LEFT JOIN payment_modes p ON t.paymentModeId = p.id
    LEFT JOIN users uv ON t.validatorId = uv.id
    LEFT JOIN users ua ON t.assignBy = ua.id
    LEFT JOIN users uve ON t.verifierBy = uve.id
    LEFT JOIN users uu ON t.userId = uu.id
    LEFT JOIN users ucre ON t.createdBy = ucre.id
    LEFT JOIN users umod ON t.modifiedBy = umod.id
    LEFT JOIN regions ON t.regionId = regions.id
    LEFT JOIN units ON t.unitId = units.id
WHERE
    t.deleted = 0
ORDER BY
    t.created_at DESC;

----------------------------------------- 
-- View all users  
-----------------------------------------
CREATE OR REPLACE VIEW v_users AS
SELECT
    u.id,
    u.name,
    u.email,
    u.phone,
    u.ldap,
    CASE
        WHEN u.deleted = 1 THEN 'inactive'
        ELSE 'active'
    END AS status,
    u.deleted,
    u.deletedAt,
    GROUP_CONCAT(r.name SEPARATOR ', ') AS roles,
    ut.name AS unit,
    u.created_at AS createdAt,
    u.updated_at AS updatedAt
FROM
    users u
    LEFT JOIN user_roles ur ON u.id = ur.userId
    LEFT JOIN roles r ON r.id = ur.roleId
    LEFT JOIN units ut ON ut.id = u.unitId
GROUP BY
    u.id,
    u.name,
    u.email,
    u.phone,
    u.ldap,
    ut.name
ORDER BY
    u.created_at DESC;

----------------------------------------- 
-- View all users with id
-----------------------------------------
CREATE OR REPLACE VIEW v_users_id AS
SELECT
    u.id,
    u.name,
    u.email,
    u.ldap,
    u.password,
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
    u.created_at DESC;

----------------------------------------- 
-- View for control old version
-----------------------------------------
CREATE
OR REPLACE VIEW v_transactions_unicity0 AS
SELECT
    t.id,
    t.reference,
    CONCAT (
        REPLACE (t.name, ' ', ''),
        '-',
        t.amount,
        '-',
        t.bankId,
        '-',
        t.branchId,
        '-',
        t.paymentModeId,
        '-',
        DATE_FORMAT (t.paymentDate, '%Y-%m-%d')
    ) AS delta,
    u.email,
    u.phone
FROM
    transactions t
    left join users u ON t.createdBy = u.id
ORDER BY
    t.created_at DESC;

----------------------------------------- 
-- View for control review
-----------------------------------------
CREATE
OR REPLACE VIEW v_transactions_unicity AS
SELECT
    t.id,
    t.reference,
    b.name bank,
    br.name branch,
    t.amount,
    t.statusId,
    DATE_FORMAT (t.paymentDate, '%Y-%m-%d') AS paymentDate,
    CONCAT (
        t.amount,
        '-',
        t.bankId,
        '-',
        t.branchId,
        '-',
        t.paymentModeId,
        '-',
        DATE_FORMAT (t.paymentDate, '%Y-%m-%d')
    ) AS delta,
    u.email,
    u.phone
FROM
    transactions t
    LEFT JOIN users u ON t.createdBy = u.id
    LEFT JOIN banks b ON t.bankId = b.id
    LEFT JOIN bank_agencies br ON t.branchId = br.id
ORDER BY
    t.created_at DESC;

----------------------------------------- 
-- View for permissions by roles
-----------------------------------------
CREATE OR REPLACE VIEW v_role_permissions AS
SELECT
    r.id,
    r.name AS role,
    GROUP_CONCAT(p.name SEPARATOR ', ') AS permissions
FROM
    roles r
    LEFT JOIN role_permissions rp ON r.id = rp.roleId
    LEFT JOIN permissions p ON p.id = rp.permissionId
GROUP BY
    r.id, r.name
ORDER BY
    r.created_at DESC;

----------------------------------------- 
-- View for assignments
-----------------------------------------
CREATE
OR REPLACE VIEW v_assignments AS
SELECT
    a.id,
    a.status,
    a.reference,
    a.unitId,
    ut.name AS unit,
    a.userId AS userId,
    u.name AS user,
    u.email AS userEmail,
    u.phone AS userPhone,
    a.validatorId,
    uv.name validator,
    a.validatedAt,
    uv.email validatorEmail,
    uv.phone validatorPhone,
    a.reasonForRefusal,
    a.created_at AS createdAt,
    a.createdBy,
    a.updated_at AS updatedAt,
    a.modifiedBy
FROM
    assignments a
    LEFT JOIN users u ON u.id = a.userId
    LEFT JOIN users uv ON uv.id = a.validatorId
    LEFT JOIN units ut ON ut.id = a.unitId
WHERE
    a.deleted = 0
ORDER BY
    a.created_at DESC;