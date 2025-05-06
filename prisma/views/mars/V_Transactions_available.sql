SELECT
  `t`.`id` AS `id`,
  `t`.`reference` AS `reference`,
  `t`.`name` AS `name`,
  `t`.`amount` AS `amount`,
  `b`.`name` AS `bank`,
  `t`.`branchId` AS `branchId`,
  `br`.`name` AS `branch`,
  `br`.`town` AS `town`,
  `t`.`paymentDate` AS `paymentDate`,
  `p`.`name` AS `paymentMode`,
  `t`.`description` AS `description`,
  `t`.`statusId` AS `statusId`,
  `s`.`name` AS `status`,
  `t`.`isReceiptReady` AS `isReceiptReady`,
  `uv`.`name` AS `validator`,
  `t`.`validatedAt` AS `validatedAt`,
  `ua`.`name` AS `assignator`,
  `t`.`assignAt` AS `assignAt`,
  `uve`.`name` AS `verificator`,
  `t`.`verifierAt` AS `verifierAt`,
  `t`.`refusal` AS `refusal`,
  `t`.`advice_duplication` AS `adviceDuplication`,
  `t`.`reasonForRefusal` AS `reasonForRefusal`,
  `t`.`userId` AS `userId`,
  `uu`.`name` AS `assignTo`,
  `mars`.`regions`.`name` AS `region`,
  `mars`.`units`.`name` AS `unit`,
  `t`.`createdBy` AS `createdBy`,
  `ucre`.`name` AS `creator`,
  `t`.`created_at` AS `createdAt`,
  `umod`.`name` AS `modificator`,
  `t`.`updated_at` AS `updatedAt`
FROM
  (
    (
      (
        (
          (
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
                  LEFT JOIN `mars`.`users` `uv` ON((`t`.`validatorId` = `uv`.`id`))
                )
                LEFT JOIN `mars`.`users` `ua` ON((`t`.`assignBy` = `ua`.`id`))
              )
              LEFT JOIN `mars`.`users` `uve` ON((`t`.`verifierBy` = `uve`.`id`))
            )
            LEFT JOIN `mars`.`users` `uu` ON((`t`.`userId` = `uu`.`id`))
          )
          LEFT JOIN `mars`.`users` `ucre` ON((`t`.`createdBy` = `ucre`.`id`))
        )
        LEFT JOIN `mars`.`users` `umod` ON((`t`.`modifiedBy` = `umod`.`id`))
      )
      LEFT JOIN `mars`.`regions` ON((`t`.`regionId` = `mars`.`regions`.`id`))
    )
    LEFT JOIN `mars`.`units` ON((`t`.`unitId` = `mars`.`units`.`id`))
  )
WHERE
  (`t`.`deleted` = 0)
ORDER BY
  `t`.`created_at` DESC