"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowDownRight, ArrowUpRight, CheckCircle, Clock, CreditCard, DollarSign, Download, Wallet } from "lucide-react";
import { Dispatch, SetStateAction, useState } from "react";
type Transaction = {
  id: number;
  type: string;
  amount: number;
  source: string;
  date: string;
  status: string;
};
// Sample data
const transactions: Transaction[] = [
  {
    id: 1,
    type: "earning",
    amount: 12.5,
    source: "Quiz plays",
    date: "2023-05-15",
    status: "completed",
  },
  {
    id: 2,
    type: "earning",
    amount: 8.75,
    source: "Affiliate commission",
    date: "2023-05-10",
    status: "completed",
  },
  {
    id: 3,
    type: "withdrawal",
    amount: 20.0,
    source: "PayPal",
    date: "2023-05-03",
    status: "completed",
  },
  {
    id: 4,
    type: "earning",
    amount: 5.25,
    source: "Quiz plays",
    date: "2023-04-28",
    status: "completed",
  },
  {
    id: 5,
    type: "withdrawal",
    amount: 15.0,
    source: "Bank transfer",
    date: "2023-04-25",
    status: "pending",
  },
];

export function WalletDashboard() {
  const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");

  const balance = 124.5;
  const pendingWithdrawals = transactions.filter((t) => t.type === "withdrawal" && t.status === "pending").reduce((sum, t) => sum + t.amount, 0);

  const totalEarnings = transactions.filter((t) => t.type === "earning").reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${balance.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Available for withdrawal</p>
            <Button className="mt-3 w-full" onClick={() => setIsWithdrawDialogOpen(true)}>
              <Download className="mr-2 h-4 w-4" />
              Withdraw
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Withdrawals</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${pendingWithdrawals.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Being processed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalEarnings.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Lifetime earnings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$42.50</div>
            <p className="text-xs text-muted-foreground">+12% from last month</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>Your recent financial activity</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">All Transactions</TabsTrigger>
              <TabsTrigger value="earnings">Earnings</TabsTrigger>
              <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              {transactions.map((transaction) => (
                <TransactionCard key={transaction.id} transaction={transaction} />
              ))}
            </TabsContent>

            <TabsContent value="earnings" className="space-y-4">
              {transactions
                .filter((t) => t.type === "earning")
                .map((transaction) => (
                  <TransactionCard key={transaction.id} transaction={transaction} />
                ))}
            </TabsContent>

            <TabsContent value="withdrawals" className="space-y-4">
              {transactions
                .filter((t) => t.type === "withdrawal")
                .map((transaction) => (
                  <TransactionCard key={transaction.id} transaction={transaction} />
                ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
            <CardDescription>Manage your withdrawal options</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">PayPal</p>
                    <p className="text-sm text-muted-foreground">user@example.com</p>
                  </div>
                </div>
                <Badge>Default</Badge>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Wallet className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Bank Account</p>
                    <p className="text-sm text-muted-foreground">**** 1234</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  Set Default
                </Button>
              </div>

              <Button variant="outline" className="w-full">
                Add Payment Method
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Earnings Breakdown</CardTitle>
            <CardDescription>Where your earnings come from</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">Quiz Plays</p>
                  <p className="text-sm font-medium">$78.25 (62.8%)</p>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div className="bg-primary h-full" style={{ width: "62.8%" }}></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">Affiliate Commissions</p>
                  <p className="text-sm font-medium">$32.50 (26.1%)</p>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full" style={{ width: "26.1%" }}></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">Premium Content</p>
                  <p className="text-sm font-medium">$13.75 (11.1%)</p>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div className="bg-green-500 h-full" style={{ width: "11.1%" }}></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <WithdrawDialog open={isWithdrawDialogOpen} onOpenChange={setIsWithdrawDialogOpen} balance={balance} withdrawAmount={withdrawAmount} setWithdrawAmount={setWithdrawAmount} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} />
    </div>
  );
}

function TransactionCard({ transaction }: { transaction: Transaction }) {
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex items-center gap-3">
        {transaction.type === "earning" ? (
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 shrink-0">
            <ArrowUpRight className="h-5 w-5 text-green-600" />
          </div>
        ) : (
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 shrink-0">
            <ArrowDownRight className="h-5 w-5 text-blue-600" />
          </div>
        )}

        <div>
          <p className="font-medium">
            {transaction.type === "earning" ? "Earned from" : "Withdrawal to"} {transaction.source}
          </p>
          <p className="text-sm text-muted-foreground">
            {new Date(transaction.date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
      </div>

      <div className="flex flex-col items-end">
        <p className={`font-medium ${transaction.type === "earning" ? "text-green-600" : ""}`}>
          {transaction.type === "earning" ? "+" : "-"}${transaction.amount.toFixed(2)}
        </p>
        <div className="flex items-center gap-1">
          {transaction.status === "completed" ? (
            <>
              <CheckCircle className="h-3 w-3 text-green-600" />
              <span className="text-xs text-green-600">Completed</span>
            </>
          ) : (
            <>
              <Clock className="h-3 w-3 text-amber-600" />
              <span className="text-xs text-amber-600">Pending</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
type WithdrawDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balance: number;
  withdrawAmount: string;
  setWithdrawAmount: Dispatch<SetStateAction<string>>;
  paymentMethod: string;
  setPaymentMethod: Dispatch<SetStateAction<string>>;
};
function WithdrawDialog({ open, onOpenChange, balance, withdrawAmount, setWithdrawAmount, paymentMethod, setPaymentMethod }: WithdrawDialogProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle withdrawal logic here
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Withdraw Funds</DialogTitle>
          <DialogDescription>Enter the amount you want to withdraw and select your payment method.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="flex items-center justify-between px-1">
              <p className="text-sm text-muted-foreground">Available Balance</p>
              <p className="font-medium">${balance.toFixed(2)}</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="amount">Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="amount" placeholder="0.00" className="pl-9" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">Minimum withdrawal: $10.00</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="payment-method">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="payment-method">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paypal">PayPal (user@example.com)</SelectItem>
                  <SelectItem value="bank">Bank Account (**** 1234)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!withdrawAmount || !paymentMethod || Number.parseFloat(withdrawAmount) > balance || Number.parseFloat(withdrawAmount) < 10}>
              Withdraw Funds
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
