import { NextFunction, Request, Response } from 'express';

import prismaClient from '../core/utils/prismadb';
import NotFoundException from '../core/exceptions/not-found';
import { ErrorCode } from '../core/exceptions/http-exception';

import BadRequestException from '../core/exceptions/bad-requests';


export const exportData =
    async (req: Request, res: Response, next: NextFunction) => {
        const id = req.params.id;

        if (!id) throw new BadRequestException('Invalid params', ErrorCode.INVALID_DATA)

        // check if the transaction id is valid
        const transaction = await prismaClient.transaction.findUnique({
            where: { id: id },
            select: {
                id: true,
                reference: true,
                name: true,
                amount: true,
                paymentDate: true,
                statusId: true,
                isReceiptReady:true,
            }
        });
        if (!transaction) throw new NotFoundException("Not Found", ErrorCode.RESSOURCE_NOT_FOUND);

        const query = `
            select 
            transactionId, count(*) numberOfBills, sum(paid_amount) totalAmount
            from integration_documents where transactionId='${transaction.id}' 
            group by transactionId 
        `;

        const result: any = await prismaClient.$queryRawUnsafe(query);

        const queryV = `
        select * 
        from v_transaction_integration_documents where transactionId='${transaction.id}'
        `;

        const transactions: any = await prismaClient.$queryRawUnsafe(queryV);

        return res.status(200).json({
            success: true,
            data: {
                isReceiptReady: transaction?.isReceiptReady,
                status: transaction?.statusId,
                paymentDate: transaction?.paymentDate,
                numberOfBills: Number(result[0]?.numberOfBills),
                totalAmount: Number(result[0]?.totalAmount),
                customerName: transaction.name,
                reference: transaction.reference,
                transactions
            }
        });
    };

