SELECT
  `t`.`id` AS `id`,
  `t`.`reference` AS `reference`,
  `b`.`name` AS `bank`,
  `br`.`name` AS `branch`,
  `t`.`amount` AS `amount`,
  `t`.`statusId` AS `statusId`,
  date_format(`t`.`paymentDate`, '%Y-%m-%d') AS `paymentDate`,
  concat(
    `t`.`amount`,
    '-',
    `t`.`bankId`,
    '-',
    `t`.`branchId`,
    '-',
    `t`.`paymentModeId`,
    '-',
    CONVERT(
      date_format(`t`.`paymentDate`, '%Y-%m-%d') USING utf8mb4
    )
  ) AS `delta`,
  `u`.`email` AS `email`,
  `u`.`phone` AS `phone`
FROM
  (
    (
      (
        `mars`.`transactions` `t`
        LEFT JOIN `mars`.`users` `u` ON((`t`.`createdBy` = `u`.`id`))
      )
      LEFT JOIN `mars`.`banks` `b` ON((`t`.`bankId` = `b`.`id`))
    )
    LEFT JOIN `mars`.`bank_agencies` `br` ON((`t`.`branchId` = `br`.`id`))
  )
ORDER BY
  `t`.`created_at` DESC