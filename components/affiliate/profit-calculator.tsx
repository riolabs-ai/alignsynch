"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { formatPercentValue } from "@/content/metrics";
import type { PageCopySection } from "@/content/pages";
import { metric } from "@/data/metrics";
import { fillLabel, itemLabel } from "@/lib/page-copy";
import { motion } from "framer-motion";
import { Calculator, Calendar, DollarSign, Users } from "lucide-react";
import { type JSX, useEffect, useReducer } from "react";

// Types
interface CalculatorState {
  referrals: number;
  conversionRate: number;
  averageValue: number;
  monthlyEarnings: number;
  yearlyEarnings: number;
}

type CalculatorAction =
  | { type: "SET_REFERRALS"; payload: number }
  | { type: "SET_CONVERSION_RATE"; payload: number }
  | { type: "SET_AVERAGE_VALUE"; payload: number }
  | { type: "UPDATE_EARNINGS" };

/**
 * The programme's commission, read once from the fixture: the calculator's arithmetic (`rate`)
 * and its copy (`pct`) are the same number, so they cannot drift apart.
 */
const commissionPct = metric("affiliate.maxCommission").value;
const commissionRate = commissionPct / 100;

// Initial state
const initialState: CalculatorState = {
  referrals: 10,
  conversionRate: 20,
  averageValue: 50,
  monthlyEarnings: 0,
  yearlyEarnings: 0,
};

// Action types
const actionTypes = {
  SET_REFERRALS: "SET_REFERRALS",
  SET_CONVERSION_RATE: "SET_CONVERSION_RATE",
  SET_AVERAGE_VALUE: "SET_AVERAGE_VALUE",
  UPDATE_EARNINGS: "UPDATE_EARNINGS",
} as const;

// Reducer function
function calculatorReducer(state: CalculatorState, action: CalculatorAction): CalculatorState {
  switch (action.type) {
    case actionTypes.SET_REFERRALS:
      return { ...state, referrals: action.payload };
    case actionTypes.SET_CONVERSION_RATE:
      return { ...state, conversionRate: action.payload };
    case actionTypes.SET_AVERAGE_VALUE:
      return { ...state, averageValue: action.payload };
    case actionTypes.UPDATE_EARNINGS: {
      const conversions = Math.round(state.referrals * (state.conversionRate / 100));
      const monthly = conversions * state.averageValue * commissionRate; // share the programme pays
      return {
        ...state,
        monthlyEarnings: monthly,
        yearlyEarnings: monthly * 12,
      };
    }
    default:
      return state;
  }
}

export function ProfitCalculator({ copy }: { copy: PageCopySection }): JSX.Element {
  const [state, dispatch] = useReducer(calculatorReducer, initialState);

  // Update earnings whenever input values change
  useEffect(() => {
    dispatch({ type: actionTypes.UPDATE_EARNINGS });
  }, [state.referrals, state.conversionRate, state.averageValue]);

  const handleReferralsChange = (value: number[]): void => {
    dispatch({ type: actionTypes.SET_REFERRALS, payload: value[0] });
  };

  const handleConversionRateChange = (value: number[]): void => {
    dispatch({ type: actionTypes.SET_CONVERSION_RATE, payload: value[0] });
  };

  const handleAverageValueChange = (value: number[]): void => {
    dispatch({ type: actionTypes.SET_AVERAGE_VALUE, payload: value[0] });
  };

  return (
    <section className="py-10 xl:py-20 sm:px-4 xl:px-8 bg-slate-50 dark:bg-slate-900">
      <div className="container px-4 mx-auto">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">{copy.heading}</h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            {copy.body}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Calculator inputs */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-500" />
                  {itemLabel(copy, "monthly-referrals")}
                </label>
                <span className="text-sm font-semibold bg-white dark:bg-slate-700 px-2 py-1 rounded-md shadow-sm">
                  {state.referrals}
                </span>
              </div>
              <Slider
                value={[state.referrals]}
                min={1}
                max={100}
                step={1}
                onValueChange={handleReferralsChange}
                className="py-2 "
              />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {itemLabel(copy, "monthly-referrals-hint")}
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-indigo-500" />
                  {itemLabel(copy, "conversion-rate")}
                </label>
                <span className="text-sm font-semibold bg-white dark:bg-slate-700 px-2 py-1 rounded-md shadow-sm">
                  {state.conversionRate}%
                </span>
              </div>
              <Slider
                value={[state.conversionRate]}
                min={1}
                max={100}
                step={1}
                onValueChange={handleConversionRateChange}
                className="py-2"
              />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {itemLabel(copy, "conversion-rate-hint")}
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-blue-500" />
                  {itemLabel(copy, "average-purchase-value")}
                </label>
                <span className="text-sm font-semibold bg-white dark:bg-slate-700 px-2 py-1 rounded-md shadow-sm">
                  ${state.averageValue}
                </span>
              </div>
              <Slider
                value={[state.averageValue]}
                min={10}
                max={200}
                step={5}
                onValueChange={handleAverageValueChange}
                className="py-2"
              />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {itemLabel(copy, "average-purchase-value-hint")}
              </p>
            </div>
          </motion.div>

          {/* Results */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true }}
          >
            <Card className="overflow-hidden border-0 shadow-xl bg-white dark:bg-slate-900">
              <CardHeader className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-xl">{itemLabel(copy, "earnings-potential")}</CardTitle>
                  <Calculator className="h-5 w-5 opacity-75" />
                </div>
                <CardDescription className="text-purple-100">
                  {fillLabel(itemLabel(copy, "commission-note"), {
                    percent: formatPercentValue(commissionPct),
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 xl:p-6">
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-1">
                        <Users className="h-4 w-4" />
                        <span>{itemLabel(copy, "summary-monthly-referrals")}</span>
                      </div>
                      <div className="text-2xl font-bold">{state.referrals}</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-1">
                        <Users className="h-4 w-4" />
                        <span>{itemLabel(copy, "summary-conversions")}</span>
                      </div>
                      <div className="text-2xl font-bold">
                        {Math.round(state.referrals * (state.conversionRate / 100))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-lg border border-purple-100 dark:border-purple-800/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-purple-100 dark:bg-purple-800/30 rounded-full">
                            <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                          </div>
                          <span className="font-medium">{itemLabel(copy, "monthly-earnings")}</span>
                        </div>
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          ${state.monthlyEarnings.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-lg border border-indigo-100 dark:border-indigo-800/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-indigo-100 dark:bg-indigo-800/30 rounded-full">
                            <Calendar className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <span className="font-medium">{itemLabel(copy, "yearly-earnings")}</span>
                        </div>
                        <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                          ${state.yearlyEarnings.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-sm text-slate-500 dark:text-slate-400 italic">
                    {itemLabel(copy, "disclaimer")}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
