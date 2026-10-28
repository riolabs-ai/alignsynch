"use client";
import Illustration from "@/public/quiz-ai-illustration.png";
import Image from "next/image";
import Link from "next/link";
export function CreateQuizSection() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Create a Quiz</h2>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Manual Quiz Editor Card */}
        <div className="relative overflow-hidden rounded-xl  p-8 ">
          <div className="flex flex-col h-full justify-between">
            <div className="mb-6">
              <Image src={Illustration} alt="Quiz Creator" className="h-32 w-32 mb-6" />
              <h3 className="text-3xl font-bold mb-2">Create a quiz</h3>
              <p>Play for free with 300 participants</p>
            </div>

            <Link href="/create/editor">
              <button className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-3 px-8 rounded-full transition-colors">Quiz editor</button>
            </Link>
          </div>
        </div>

        {/* AI Quiz Generator Card */}
        <div className="relative overflow-hidden rounded-xl  p-8 ">
          <div className="flex flex-col h-full justify-between">
            <div className="mb-6">
              <Image src="/quiz-ai-illustration.png" alt="AI Quiz Generator" className="h-32 w-32 mb-6" />
              <h3 className="text-3xl font-bold mb-2">A.I.</h3>
              <p>Generate a quiz from any subject or pdf</p>
            </div>

            <Link href="/create/generator">
              <button className="bg-sky-400 hover:bg-sky-500 text-white font-medium py-3 px-8 rounded-full transition-colors">Quiz generator</button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
