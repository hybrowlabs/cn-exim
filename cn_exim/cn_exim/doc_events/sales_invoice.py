import frappe
def validate(self,method):
	calc(self)
def calc(self):
	total_freight=0
	total_drawback=0
	total_insurance=0
	total_fob=0
	total_rodtep=0
	for row in self.items:
		total_freight=total_freight+row.freight
		self.freight=total_freight
		total_drawback+=row.duty_drawback_amount
		self.total_duty_drawback=total_drawback
		total_insurance+=row.insurance
		self.insurance=total_insurance
		total_fob+=row.fob_value_inr
		self.total_fob_value=total_fob
		total_rodtep+=row.meis_value
		self.total_meis=total_rodtep


		