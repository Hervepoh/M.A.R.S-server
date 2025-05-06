import { NextFunction, Request, Response } from "express";

import { sqlQuery } from "../constants/request";
import { executeQuery, getConnection, releaseConnection } from "../core/utils/db.oracle";
import { format } from "date-fns";
import InternalException from "../core/exceptions/internal-exception";
import { ErrorCode } from "../core/exceptions/http-exception";
import BadRequestException from "../core/exceptions/bad-requests";


//---------------------------------------------------------
//              get all Unpaid Bills Using Query Parameters
//---------------------------------------------------------
export const getBills = async (req: Request, res: Response, next: NextFunction) => {


  // Get Query Parameters
  const { by: searchBy, type } = req.query;
  // check user information
  const authorizeSearchBy: string[] = ["invoice"];
  if (!searchBy) throw new BadRequestException("Invalid parameters", ErrorCode.INVALID_DATA);

  if (searchBy) {
    if (!authorizeSearchBy.includes(searchBy.toString())) {
      throw new BadRequestException("Invalid parameters", ErrorCode.INVALID_DATA);
    }
  }

  switch (searchBy) {
    case "invoice":
      getBillsByInvoiceNumber(req, res, next);
      break;
    default:
      return res.status(200).json({
        success: true,
        bills: []
      });
      break;
  }
};


//---------------------------------------------------------
//              get all Unpaid Bills By Invoice Number 
//---------------------------------------------------------
export const getBillsByInvoiceNumber =
  async (req: Request, res: Response, next: NextFunction) => {

    let connection;
    try {
      // Get Invoice Number from the query params 
      const { value: invoice_number } = req.query;
      if (!invoice_number) {
        throw new BadRequestException("Invalid parameters", ErrorCode.INVALID_DATA);
        return res.status(404).json({
          success: false,
          bills: []
        });
      }
      

      // Fetch data from the database
      connection = await getConnection();
      const result = await connection.execute(sqlQuery.bills_by_invoice_number, [invoice_number]);

      // send the response
      res.status(200).json({
        success: true,
        bills: result.rows
      });
    } catch (error: any) {
      // Catch the error and return and error respons
      throw new InternalException(error.message, error, ErrorCode.INTERNAL_EXCEPTION);
    } finally {
      // close the connection to the database
      if (connection) {
        await releaseConnection(connection);
      }
    }
  };

