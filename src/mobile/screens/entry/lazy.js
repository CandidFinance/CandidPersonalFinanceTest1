import { lazy } from "react";

// Only a new visitor needs these, so they load apart from the app.
export const EntryFlow = lazy(() => import("./EntryFlow.jsx"));
export const GuessCompare = lazy(() => import("./GuessCompare.jsx"));
