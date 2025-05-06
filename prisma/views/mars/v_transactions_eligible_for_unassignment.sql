SELECT
  `t`.`id` AS `id`,
  `s`.`name` AS `status`,
  `t`.`reference` AS `reference`,
  `t`.`paymentDate` AS `paymentDate`,
  `t`.`name` AS `name`,
  `t`.`amount` AS `amount`,
  `b`.`name` AS `bank`,
  `br`.`name` AS `branch`,
  `p`.`name` AS `paymentMode`,
  `t`.`description` AS `description`,
  `mars`.`regions`.`name` AS `region`,
  `mars`.`units`.`name` AS `unit`,
  `uu`.`name` AS `user`
FROM
  (
    (
      (
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
        LEFT JOIN `mars`.`regions` ON((`t`.`regionId` = `mars`.`regions`.`id`))
      )
      LEFT JOIN `mars`.`units` ON((`t`.`unitId` = `mars`.`units`.`id`))
    )
    LEFT JOIN `mars`.`users` `uu` ON((`t`.`userId` = `uu`.`id`))
  )
WHERE
  (
    (`t`.`statusId` = 6)
    AND `t`.`id` IN (
      SELECT
        `mars`.`transaction_details`.`transactionId`
      FROM
        `mars`.`transaction_details`
      WHERE
        (`mars`.`transaction_details`.`deleted` = 0)
    ) IS false
  )