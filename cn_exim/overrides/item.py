import frappe

def validate(self,methods=None):
    if self.uoms:
        for uom in self.uoms:
            if uom.conversion_factor == 0:
                frappe.throw(
                    f"UOM conversion factor cannot be zero for UOM {uom.uom} in Item {self.name}."
                )
            