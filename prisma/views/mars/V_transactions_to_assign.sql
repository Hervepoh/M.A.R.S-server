SELECT
  `t`.`id` AS `id`,
  `t`.`reference` AS `reference`,
  `t`.`name` AS `name`,
  `t`.`amount` AS `amount`,
  `b`.`name` AS `bank`,
  `br`.`name` AS `branch`,
  `br`.`town` AS `town`,
  `t`.`paymentDate` AS `paymentDate`,
  `p`.`name` AS `paymentMode`,
  `t`.`description` AS `description`,
  `s`.`name` AS `status`
FROM
  (
    (
      (
        (
          `mars`.`transactions` `t`
          LEFT JOIN `mars`.`status` `s` ON((`t`.`statusId` = `s`.`id`))
        )
        LEFT JOIN `mars`.`banks` `b` ON((`t`.`bankId` = `b`.`id`))
      )
      LEFT JOIN `mars`.`bank_agencies` `br` ON((`t`.`branchId` = `br`.`id`))
    )
    LEFT JOIN `mars`.`payment_modes` `p` ON((`t`.`paymentModeId` = `p`.`id`))
  )
WHERE
  (
    (`t`.`statusId` = 4)
    AND `t`.`reference` IN (
      SELECT
        `mars`.`assignments`.`reference`
      FROM
        `mars`.`assignments`
      WHERE
        (
          (`mars`.`assignments`.`deleted` = 0)
          AND (
            `mars`.`assignments`.`status` IN ('PENDING', 'VALIDATE')
          )
        )
    ) IS false
  )