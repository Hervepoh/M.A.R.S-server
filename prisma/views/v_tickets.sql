CREATE
OR REPLACE
VIEW v_tickets AS
SELECT
	t.id ,
	t.reference ,
	t.`type` ,
	t.unpaidCount,
	t.unpaidAmount,
	t.comment ,
	t.status ,
	tw.workflowId,
	tw.workflowcurrentStepId ,
	t.createdBy,
	uc.name as creator,
	t.createdAt,
	t.updatedBy,
	uc.name as modifier,
	t.updatedAt,
	ws.description as workflowStatus
FROM
	tickets t
LEFT JOIN ticket_workflow tw ON
	t.id = tw.ticketId
LEFT JOIN workflow_steps ws ON
	tw.workflowcurrentStepId = ws.id
LEFT JOIN workflow_validations wv ON
	ws.id = wv.stepId
LEFT JOIN users uc ON
	t.createdBy = uc.id
LEFT JOIN users uu ON
	t.createdBy = uu.id
WHERE
	t.deleted = 0
ORDER BY
	t.createdAt DESC
;


CREATE
OR REPLACE
VIEW v_ticket_with_validator AS
SELECT
	t.id ,
	t.reference ,
	t.`type` ,
	t.unpaidCount,
	t.unpaidAmount,
	t.comment ,
	t.status ,
	tw.workflowId,
	tw.workflowcurrentStepId ,
	t.createdBy,
	uc.name as creator,
	t.createdAt,
	t.updatedBy,
	uc.name as modifier,
	t.updatedAt,
	ws.description as workflowStatus,
	wvu.userId as validatorUId,
	ur.userId as validatorId,
	ur.roleId as validatorRoleId
FROM
	tickets t
LEFT JOIN ticket_workflow tw ON
	t.id = tw.ticketId
LEFT JOIN workflow_steps ws ON
	tw.workflowcurrentStepId = ws.id
LEFT JOIN workflow_validations wv ON
	ws.id = wv.stepId
LEFT JOIN workflow_validation_roles wvr ON
	wv.id = wvr.workflowValidationId
LEFT JOIN workflow_validation_users wvu ON
	wv.id = wvu.workflowValidationId
LEFT JOIN user_roles ur ON
    ur.roleId = wvr.roleId 
LEFT JOIN users uc ON
	t.createdBy = uc.id
LEFT JOIN users uu ON
	t.createdBy = uu.id
WHERE
	t.deleted = 0
ORDER BY
	t.createdAt DESC
;


CREATE
OR REPLACE
VIEW v_ticket AS
SELECT
	t.id ,
	t.reference ,
	t.`type` ,
	t.unpaidCount,
	t.unpaidAmount,
	t.comment ,
	t.status ,
	ticc.*,
	tw.workflowId,
	tw.workflowcurrentStepId ,
	t.createdBy,
	uc.name as creator,
	t.createdAt,
	t.updatedBy,
	uc.name as modifier,
	t.updatedAt,
	ws.description as workflowStatus,
	wvu.userId as validatorUId,
	ur.userId as validatorId,
	ur.roleId as validatorRoleId
FROM
	tickets t
JOIN t_import_clients_cms ticc ON
	t.reference = ticc.SERVICE_NUMBER
LEFT JOIN ticket_workflow tw ON
	t.id = tw.ticketId
LEFT JOIN workflow_steps ws ON
	tw.workflowcurrentStepId = ws.id
LEFT JOIN workflow_validations wv ON
	ws.id = wv.stepId
LEFT JOIN workflow_validation_roles wvr ON
	wv.id = wvr.workflowValidationId
LEFT JOIN workflow_validation_users wvu ON
	wv.id = wvu.workflowValidationId
LEFT JOIN user_roles ur ON
	ur.roleId = wvr.roleId
LEFT JOIN users uc ON
	t.createdBy = uc.id
LEFT JOIN users uu ON
	t.createdBy = uu.id
WHERE
	t.deleted = 0
ORDER BY
	t.createdAt DESC
;