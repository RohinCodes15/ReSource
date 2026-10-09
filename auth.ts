import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { db } from "@/src/db";

const databaseUrl = process.env.DATABASE_URL;
const demoDatabaseIsLocal = (() => {
  try {
    const url = new URL(databaseUrl ?? "");
    return ["localhost","127.0.0.1"].includes(url.hostname) && url.pathname.includes("demo");
  } catch {return false;}
})();
const demoEnabled = process.env.NODE_ENV !== "production" &&
  process.env.DEMO_MODE === "true" && process.env.DEMO_DATABASE === "true" && demoDatabaseIsLocal;
const providers = [
  GitHub({
    clientId: process.env.AUTH_GITHUB_ID ?? "",
    clientSecret: process.env.AUTH_GITHUB_SECRET ?? "",
  }),
  ...(demoEnabled ? [Credentials({
    id:"fictional-demo", name:"Fictional local demo",
    credentials:{identity:{label:"Fictional role",type:"text"}},
    async authorize(input) {
      const result = z.object({identity:z.enum(["demo-user-1","demo-user-2","demo-provider-1","demo-coordinator-1"])}).safeParse(input);
      if (!result.success) return null;
      const user = await db.user.findUnique({where:{id:result.data.identity}});
      return user ? {id:user.id,name:user.name,email:user.email} : null;
    },
  })] : []),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  trustHost: process.env.NODE_ENV !== "production" || process.env.AUTH_TRUST_HOST === "true",
  session:{strategy:"jwt"},
  pages:{signIn:"/signin"},
  callbacks:{
    async signIn({user,account}) {
      if (account?.provider === "fictional-demo") return demoEnabled && !!user.id;
      if (account?.provider !== "github" || !account.providerAccountId) return false;
      const member = await db.user.findUnique({where:{authSubject:"github:"+account.providerAccountId}});
      return !!member;
    },
    async jwt({token,account,user}) {
      if (account?.provider === "github" && account.providerAccountId) token.memberSubject = "github:"+account.providerAccountId;
      if (account?.provider === "fictional-demo" && user?.id) token.demoUserId = user.id;
      return token;
    },
    async session({session,token}) {
      if (session.user) {
        if (typeof token.memberSubject === "string") {
          const member = await db.user.findUnique({where:{authSubject:token.memberSubject}});
          session.user.id = member?.id ?? "";
        } else {
          session.user.id = demoEnabled && typeof token.demoUserId === "string" ? token.demoUserId : "";
        }
      }
      return session;
    },
  },
});
