import { DeployButton } from "@/components/deploy-button";
import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { Hero } from "@/components/hero";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { ConnectSupabaseSteps } from "@/components/tutorial/connect-supabase-steps";
import { SignUpUserSteps } from "@/components/tutorial/sign-up-user-steps";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import { Suspense } from "react";


export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="w-full flex flex-col flex-1 items-center">

        <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
          <div className="w-full max-w-5xl flex justify-between items-center px-5">
            <Link href="/" className="font-bold text-xl">
              Ball Knower
            </Link>

            {!hasEnvVars ? (
              <EnvVarWarning />
            ) : (
              <Suspense>
                <AuthButton />
              </Suspense>
            )}
          </div>
        </nav>

        <section className="flex-1 flex flex-col items-center justify-center text-center gap-6 px-5 py-20">
          <h1 className="text-5xl font-bold">
            Ball Knower
          </h1>

          <p className="text-xl text-gray-500 max-w-xl">
            Explore, Compare, and Predict professional tennis matches.
          </p>

          <div className="flex flex-wrap justify-center gap-4 mt-6">
            <Link
              href="/players"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            >
              Player Search
            </Link>

            <Link
              href="/compare"
              className="border px-6 py-3 rounded-lg hover:bg-gray-100 hover:text-black"
            >
              Compare Players
            </Link>

            <Link
              href="/predictions"
              className="border px-6 py-3 rounded-lg hover:bg-gray-100 hover:text-black"
            >
              Match Predictions
            </Link>
          </div>
        </section>

        <footer className="w-full flex justify-center items-center gap-5 border-t p-6">
          <ThemeSwitcher />
        </footer>

      </div>
    </main>
  );
}

