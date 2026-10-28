"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Check, CreditCard, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function SubscriptionSettings() {
  const [isLoading, setIsLoading] = useState(false);
  const [currentPlan, setCurrentPlan] = useState("pro");
  const [billingCycle, setBillingCycle] = useState("monthly");

  const handleUpgrade = (plan: string) => {
    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      setCurrentPlan(plan);
      setIsLoading(false);
      toast.success(`Successfully upgraded to ${plan} plan!`);
    }, 1000);
  };

  const handleCancel = () => {
    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      toast.success("Successfully canceled your subscription!");
    }, 1000);
  };

  const handleBillingCycleChange = (cycle: string) => {
    setBillingCycle(cycle);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Subscription Settings</h3>
        <p className="text-sm text-muted-foreground">Manage your subscription plan and billing information.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>You are currently on the {currentPlan === "free" ? "Free" : currentPlan === "pro" ? "Pro" : "Premium"} plan.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-lg font-semibold">
                {currentPlan === "free" ? "Free Plan" : currentPlan === "pro" ? "Pro Plan" : "Premium Plan"}
                {currentPlan !== "free" && (
                  <Badge variant="outline" className="ml-2">
                    {billingCycle === "monthly" ? "Monthly" : "Annual"}
                  </Badge>
                )}
              </h4>
              <p className="text-sm text-muted-foreground mt-1">{currentPlan === "free" ? "Basic features with limited access" : currentPlan === "pro" ? "Advanced features for quiz creators" : "All features with priority support"}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{currentPlan === "free" ? "Free" : currentPlan === "pro" ? (billingCycle === "monthly" ? "$9.99" : "$99.99") : billingCycle === "monthly" ? "$19.99" : "$199.99"}</p>
              {currentPlan !== "free" && <p className="text-sm text-muted-foreground">{billingCycle === "monthly" ? "per month" : "per year"}</p>}
            </div>
          </div>

          {currentPlan !== "free" && (
            <div className="mt-6">
              <p className="text-sm font-medium mb-2">Billing Cycle</p>
              <RadioGroup value={billingCycle} onValueChange={handleBillingCycleChange} className="flex space-x-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="monthly" id="monthly" />
                  <Label htmlFor="monthly">Monthly</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="annual" id="annual" />
                  <Label htmlFor="annual">Annual (Save 16%)</Label>
                </div>
              </RadioGroup>
            </div>
          )}

          <div className="mt-6 space-y-4">
            <p className="text-sm font-medium">Plan Features:</p>
            <ul className="space-y-2">
              {currentPlan === "free" ? (
                <>
                  <li className="flex items-center text-sm">
                    <Check className="mr-2 h-4 w-4 text-primary" />
                    Create up to 5 quizzes
                  </li>
                  <li className="flex items-center text-sm">
                    <Check className="mr-2 h-4 w-4 text-primary" />
                    Basic quiz templates
                  </li>
                  <li className="flex items-center text-sm">
                    <Check className="mr-2 h-4 w-4 text-primary" />
                    Standard support
                  </li>
                </>
              ) : currentPlan === "pro" ? (
                <>
                  <li className="flex items-center text-sm">
                    <Check className="mr-2 h-4 w-4 text-primary" />
                    Create unlimited quizzes
                  </li>
                  <li className="flex items-center text-sm">
                    <Check className="mr-2 h-4 w-4 text-primary" />
                    Advanced quiz templates
                  </li>
                  <li className="flex items-center text-sm">
                    <Check className="mr-2 h-4 w-4 text-primary" />
                    Detailed analytics
                  </li>
                  <li className="flex items-center text-sm">
                    <Check className="mr-2 h-4 w-4 text-primary" />
                    Priority support
                  </li>
                </>
              ) : (
                <>
                  <li className="flex items-center text-sm">
                    <Check className="mr-2 h-4 w-4 text-primary" />
                    All Pro features
                  </li>
                  <li className="flex items-center text-sm">
                    <Check className="mr-2 h-4 w-4 text-primary" />
                    Custom branding
                  </li>
                  <li className="flex items-center text-sm">
                    <Check className="mr-2 h-4 w-4 text-primary" />
                    API access
                  </li>
                  <li className="flex items-center text-sm">
                    <Check className="mr-2 h-4 w-4 text-primary" />
                    Dedicated support
                  </li>
                  <li className="flex items-center text-sm">
                    <Check className="mr-2 h-4 w-4 text-primary" />
                    Early access to new features
                  </li>
                </>
              )}
            </ul>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          {currentPlan === "free" ? (
            <Button onClick={() => handleUpgrade("pro")} disabled={isLoading} className="w-full">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Upgrade to Pro
            </Button>
          ) : currentPlan === "pro" ? (
            <div className="w-full space-y-2">
              <Button onClick={() => handleUpgrade("premium")} disabled={isLoading} className="w-full">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Upgrade to Premium
              </Button>
              <Button variant="outline" onClick={handleCancel} disabled={isLoading} className="w-full">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Cancel Subscription
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={handleCancel} disabled={isLoading} className="w-full">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cancel Subscription
            </Button>
          )}
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment Method</CardTitle>
          <CardDescription>Manage your payment methods and billing information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center space-x-4">
              <CreditCard className="h-6 w-6 text-primary" />
              <div>
                <p className="font-medium">Visa ending in 4242</p>
                <p className="text-sm text-muted-foreground">Expires 12/2025</p>
              </div>
            </div>
            <Badge>Default</Badge>
          </div>

          <Button variant="outline" className="w-full">
            Add Payment Method
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
          <CardDescription>View your past invoices and payment history.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Pro Plan - Monthly</p>
                <p className="text-sm text-muted-foreground">April 1, 2023</p>
              </div>
              <div className="text-right">
                <p className="font-medium">$9.99</p>
                <Badge variant="outline" className="ml-2">
                  Paid
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Pro Plan - Monthly</p>
                <p className="text-sm text-muted-foreground">March 1, 2023</p>
              </div>
              <div className="text-right">
                <p className="font-medium">$9.99</p>
                <Badge variant="outline" className="ml-2">
                  Paid
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Pro Plan - Monthly</p>
                <p className="text-sm text-muted-foreground">February 1, 2023</p>
              </div>
              <div className="text-right">
                <p className="font-medium">$9.99</p>
                <Badge variant="outline" className="ml-2">
                  Paid
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="outline" className="w-full">
            View All Invoices
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
