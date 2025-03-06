from india_compliance.gst_india.utils.e_waybill import EWaybillData
from india_compliance.gst_india.utils import (
    is_foreign_doc,
)
from frappe.utils import (
    random_string,
)
import frappe
def custom_get_transaction_data(self):
        if self.sandbox_mode:
            REGISTERED_GSTIN = "05AAACG2115R1ZN"
            OTHER_GSTIN = "05AAACG2140A1ZL"

            self.transaction_details.update(
                {
                    "company_gstin": REGISTERED_GSTIN,
                    "name": (
                        random_string(6).lstrip("0")
                        if not frappe.flags.in_test
                        else "test_invoice_no"
                    ),
                }
            )

            # to ensure company_gstin is inline with company address gstin
            sandbox_gstin = {
                ("Sales Invoice", 0): (REGISTERED_GSTIN, OTHER_GSTIN),
                ("Sales Invoice", 1): (OTHER_GSTIN, REGISTERED_GSTIN),
                ("Purchase Invoice", 0): (OTHER_GSTIN, REGISTERED_GSTIN),
                ("Purchase Invoice", 1): (REGISTERED_GSTIN, OTHER_GSTIN),
                ("Purchase Receipt", 0): (OTHER_GSTIN, REGISTERED_GSTIN),
                ("Purchase Receipt", 1): (REGISTERED_GSTIN, OTHER_GSTIN),
                ("Delivery Note", 0): (REGISTERED_GSTIN, OTHER_GSTIN),
                ("Delivery Note", 1): (OTHER_GSTIN, REGISTERED_GSTIN),
                ("Stock Entry", 0): (REGISTERED_GSTIN, OTHER_GSTIN),
                ("Subcontracting Receipt", 0): (OTHER_GSTIN, REGISTERED_GSTIN),
                ("Subcontracting Receipt", 1): (REGISTERED_GSTIN, OTHER_GSTIN),
                ("E-way Bill", 0): (OTHER_GSTIN, REGISTERED_GSTIN),
                ("E-way Bill", 1): (REGISTERED_GSTIN, OTHER_GSTIN),
            }

            if self.bill_from.gstin == self.bill_to.gstin:
                sandbox_gstin.update(
                    {
                        ("Delivery Note", 0): (REGISTERED_GSTIN, REGISTERED_GSTIN),
                        ("Delivery Note", 1): (REGISTERED_GSTIN, REGISTERED_GSTIN),
                    }
                )

            def _get_sandbox_gstin(address, key):
                if address.gstin == "URP":
                    return address.gstin
                
                return sandbox_gstin.get(
                    (self.doc.doctype, self.doc.get("is_return") or 0)
                )[key]

            self.bill_from.gstin = _get_sandbox_gstin(self.bill_from, 0)
            self.bill_to.gstin = _get_sandbox_gstin(self.bill_to, 1)
        data = {
            "userGstin": self.transaction_details.company_gstin,
            "supplyType": self.transaction_details.supply_type,
            "subSupplyType": self.transaction_details.sub_supply_type,
            "subSupplyDesc": self.transaction_details.sub_supply_desc,
            "docType": self.transaction_details.document_type,
            "docNo": self.transaction_details.name,
            "docDate": self.transaction_details.date,
            "transactionType": self.transaction_details.transaction_type,
            "fromTrdName": self.bill_from.legal_name,
            "fromGstin": self.bill_from.gstin,
            "fromAddr1": self.ship_from.address_line1,
            "fromAddr2": self.ship_from.address_line2,
            "fromPlace": self.ship_from.city,
            "fromPincode": self.ship_from.pincode,
            "fromStateCode": self.bill_from.state_number,
            "actFromStateCode": self.ship_from.state_number,
            "toTrdName": self.bill_to.legal_name,
            "toGstin": self.bill_to.gstin,
            "toAddr1": self.ship_to.address_line1,
            "toAddr2": self.ship_to.address_line2,
            "toPlace": self.ship_to.city,
            "toPincode": self.ship_to.pincode,
            "toStateCode": self.bill_to.state_number,
            "actToStateCode": self.ship_to.state_number,
            "totalValue": self.transaction_details.total,
            "cgstValue": self.transaction_details.total_cgst_amount,
            "sgstValue": self.transaction_details.total_sgst_amount,
            "igstValue": self.transaction_details.total_igst_amount,
            "cessValue": self.transaction_details.total_cess_amount,
            "cessNonAdvolValue": self.transaction_details.total_cess_non_advol_amount,
            "otherValue": (
                self.transaction_details.rounding_adjustment
                + self.transaction_details.other_charges
                - self.transaction_details.discount_amount
            ),
            "totInvValue": self.transaction_details.grand_total,
            "transMode": self.transaction_details.mode_of_transport,
            "transDistance": self.transaction_details.distance,
            "transporterName": self.transaction_details.transporter_name,
            "transporterId": self.transaction_details.gst_transporter_id,
            "transDocNo": self.transaction_details.lr_no,
            "transDocDate": self.transaction_details.lr_date,
            "vehicleNo": self.transaction_details.vehicle_no,
            "vehicleType": self.transaction_details.vehicle_type,
            "itemList": self.item_list,
            "mainHsnCode": self.transaction_details.main_hsn_code,
        }

        if self.for_json:
            for key, value in (
                # keys that are different in for_json
                {
                    "transactionType": "transType",
                    "actFromStateCode": "actualFromStateCode",
                    "actToStateCode": "actualToStateCode",
                    "otherValue": "OthValue",
                    "cessNonAdvolValue": "TotNonAdvolVal",
                }
            ).items():
                data[value] = data.pop(key)

            return data

        return self.sanitize_data(data)
    
def custom_update_transaction_details(self):
        # first HSN Code for goods
        doc = self.doc
        main_hsn_code = next(
            row.gst_hsn_code
            for row in doc.items
            if not row.gst_hsn_code.startswith("99")
        )

        self.transaction_details.update(
            sub_supply_desc="",
            main_hsn_code=main_hsn_code,
        )

    
        default_supply_types = {
            # Key: (doctype, is_return)
            ("Sales Invoice", 0): {
                "supply_type": "O",
                "sub_supply_type": 1,  # Supply
                "document_type": "INV",
            },
            ("Sales Invoice", 1): {
                "supply_type": "I",
                "sub_supply_type": 7,  # Sales Return
                "document_type": "CHL",
            },
            ("Delivery Note", 0): {
                "supply_type": "O",
                "sub_supply_type": doc.get("_sub_supply_type", ""),
                "sub_supply_desc": doc.get("_sub_supply_desc", ""),
                "document_type": "CHL",
            },
            ("Delivery Note", 1): {
                "supply_type": "I",
                "sub_supply_type": doc.get("_sub_supply_type", ""),
                "sub_supply_desc": doc.get("_sub_supply_desc", ""),
                "document_type": "CHL",
            },
            ("Purchase Invoice", 0): {
                "supply_type": "I",
                "sub_supply_type": 1,  # Supply
                "document_type": "INV",
            },
            ("Purchase Invoice", 1): {
                "supply_type": "O",
                "sub_supply_type": 8,  # Others
                "document_type": "OTH",
                "sub_supply_desc": "Purchase Return",
            },
            ("Purchase Receipt", 0): {
                "supply_type": "I",
                "sub_supply_type": 1,  # Supply
                "document_type": "INV",
            },
            ("Purchase Receipt", 1): {
                "supply_type": "O",
                "sub_supply_type": 8,  # Others
                "document_type": "CHL",
                "sub_supply_desc": "Purchase Return",
            },
            ("Stock Entry", 0): {
                "supply_type": "O",
                "sub_supply_type": doc.get("_sub_supply_type", ""),
                "document_type": "CHL",
            },
            ("Subcontracting Receipt", 0): {
                "supply_type": "I",
                "sub_supply_type": doc.get("_sub_supply_type", ""),
                "document_type": "CHL",
            },
            ("Subcontracting Receipt", 1): {
                "supply_type": "O",
                "sub_supply_type": doc.get("_sub_supply_type", ""),
                "document_type": "CHL",
            },
            ("E-way Bill", 0):{
                "supply_type": "I",
                "sub_supply_type": 1,
                "document_type": "INV",
            },
            ("E-way Bill", 1):{
                "supply_type": "0",
                "sub_supply_type": 8,
                "document_type":"CHL",
                "sub_supply_desc": "Purchase Return",
            }
        }
        
        self.transaction_details.update(
            default_supply_types.get((doc.doctype, doc.get("is_return") or 0), {})
        )

        if is_foreign_doc(self.doc):
            self.transaction_details.update(sub_supply_type=3)  # Export
            if not doc.is_export_with_gst:
                self.transaction_details.update(document_type="BIL")

        if (
            doc.doctype in ("Sales Invoice", "Purchase Invoice")
            and not doc.is_return
            and all(
                item.gst_treatment in ("Nil-Rated", "Exempted", "Non-GST")
                for item in doc.items
            )
        ):
            self.transaction_details.update(document_type="BIL")

        if self.doc.doctype == "Purchase Invoice" and not self.doc.is_return:
            self.transaction_details.name = self.doc.bill_no or self.doc.name
    
