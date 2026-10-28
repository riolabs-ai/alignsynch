"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, DollarSign, ExternalLink, LinkIcon, Share2, TrendingUp, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
type Referral = {
  id: number;
  username: string;
  name: string;
  date: string;
  status: string;
  earnings: number;
  avatar: string;
};
// Sample data
const referrals: Referral[] = [
  {
    id: 1,
    username: "johndoe",
    name: "John Doe",
    date: "2023-05-15",
    status: "active",
    earnings: 12.5,
    avatar: "/avatars/alex.png",
  },
  {
    id: 2,
    username: "sarahsmith",
    name: "Sarah Smith",
    date: "2023-05-10",
    status: "active",
    earnings: 8.75,
    avatar: "/avatars/sarah.webp",
  },
  {
    id: 3,
    username: "mikebrown",
    name: "Mike Brown",
    date: "2023-05-03",
    status: "inactive",
    earnings: 5.25,
    avatar: "/avatars/brain.png",
  },
  {
    id: 4,
    username: "emilyjones",
    name: "Emily Jones",
    date: "2023-04-28",
    status: "active",
    earnings: 6.0,
    avatar: "/avatars/guru.png",
  },
];

export function AffiliateDashboard() {
  const referralLink = "https://quizmaker.com/ref/username123";

  const totalReferrals = referrals.length;
  const activeReferrals = referrals.filter((r) => r.status === "active").length;
  const totalEarnings = referrals.reduce((sum, r) => sum + r.earnings, 0);
  const conversionRate = 24.8; // Percentage

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    // Show toast notification
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReferrals}</div>
            <p className="text-xs text-muted-foreground">Users who signed up with your link</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Referrals</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeReferrals}</div>
            <p className="text-xs text-muted-foreground">{((activeReferrals / totalReferrals) * 100).toFixed(1)}% of total referrals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalEarnings.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">From affiliate commissions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversionRate}%</div>
            <p className="text-xs text-muted-foreground">Of link clicks that convert</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Referral Link</CardTitle>
          <CardDescription>Share this link to earn commissions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={referralLink} readOnly className="pl-9" />
            </div>
            <Button onClick={copyReferralLink}>
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </Button>
            <Button>
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-sm">Commission Rate</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">20%</div>
                <p className="text-xs text-muted-foreground">Of all earnings from your referrals</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-sm">Link Clicks</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">169</div>
                <p className="text-xs text-muted-foreground">In the last 30 days</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-sm">Pending Commissions</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">$18.25</div>
                <p className="text-xs text-muted-foreground">Will be added to your balance soon</p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Referrals</CardTitle>
          <CardDescription>Users who signed up using your referral link</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">All Referrals</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="inactive">Inactive</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              {referrals.map((referral) => (
                <ReferralCard key={referral.id} referral={referral} />
              ))}
            </TabsContent>

            <TabsContent value="active" className="space-y-4">
              {referrals
                .filter((r) => r.status === "active")
                .map((referral) => (
                  <ReferralCard key={referral.id} referral={referral} />
                ))}
            </TabsContent>

            <TabsContent value="inactive" className="space-y-4">
              {referrals
                .filter((r) => r.status === "inactive")
                .map((referral) => (
                  <ReferralCard key={referral.id} referral={referral} />
                ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Commission Tiers</CardTitle>
          <CardDescription>Earn more as you refer more users</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative pt-4">
              <div className="absolute top-0 left-0 w-full h-2 bg-muted rounded-full overflow-hidden">
                <div className="bg-primary h-full" style={{ width: "60%" }}></div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0</span>
                <span>25</span>
                <span>50</span>
                <span>100+</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Basic Tier</p>
                  <p className="text-sm text-muted-foreground">0-24 active referrals</p>
                </div>
                <Badge>20% Commission</Badge>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Silver Tier</p>
                  <p className="text-sm text-muted-foreground">25-49 active referrals</p>
                </div>
                <Badge variant="outline">25% Commission</Badge>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Gold Tier</p>
                  <p className="text-sm text-muted-foreground">50-99 active referrals</p>
                </div>
                <Badge variant="outline">30% Commission</Badge>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Platinum Tier</p>
                  <p className="text-sm text-muted-foreground">100+ active referrals</p>
                </div>
                <Badge variant="outline">35% Commission</Badge>
              </div>
            </div>

            <div className="flex justify-center">
              <Button variant="outline" asChild>
                <Link href="/affiliate">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Learn More About Our Affiliate Program
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReferralCard({ referral }: { referral: Referral }) {
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex items-center gap-3">
        <div className="relative w-10 h-10 rounded-full overflow-hidden">
          <Image src={referral.avatar || "/placeholder.svg"} alt={referral.name} fill className="object-cover" />
        </div>

        <div>
          <p className="font-medium">{referral.name}</p>
          <p className="text-sm text-muted-foreground">@{referral.username}</p>
        </div>
      </div>

      <div className="hidden md:block">
        <p className="text-sm">
          Joined{" "}
          {new Date(referral.date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </p>
      </div>

      <div className="flex flex-col items-end">
        <p className="font-medium text-green-600">${referral.earnings.toFixed(2)}</p>
        <Badge variant={referral.status === "active" ? "default" : "outline"} className="mt-1">
          {referral.status === "active" ? "Active" : "Inactive"}
        </Badge>
      </div>
    </div>
  );
}
