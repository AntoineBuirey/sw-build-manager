import { CreationType, Usage } from "../models";


export const TYPE_MAP: Record<CreationType, string> = {
    [CreationType.AIRCRAFT]: "A",
    [CreationType.BOAT]: "O",
    [CreationType.GROUND_VEHICLE]: "G",
    [CreationType.SPACECRAFT]: "S",
    [CreationType.BUILDING]: "B",
    [CreationType.SUBMARINE]: "U",
    [CreationType.WEAPON]: "W",
    [CreationType.UNKNOWN]: "Z"
};

export type TypeMapLetters = "A" | "O" | "G" | "S" | "B" | "U" | "W" | "Z";


export const USAGE_MAP: Record<Usage, string> = {
    [Usage.SEARCH_AND_RESCUE]: "R",
    [Usage.FIRE_FIGHTING]: "F",
    [Usage.TRANSPORT]: "T",
    [Usage.COMBAT]: "C",
    [Usage.RESEARCH]: "E",
    [Usage.EXPLORATION]: "X",
    [Usage.RECREATIONAL]: "Y",
    [Usage.SURVEILLANCE]: "V",
    [Usage.COMMUNICATIONS]: "M",
    [Usage.CONSTRUCTION]: "N",
    [Usage.MINING]: "I",
    [Usage.AGRICULTURE]: "A",
    [Usage.FISHING]: "H",
    [Usage.TOURISM]: "O",
    [Usage.UNKNOWN]: "Z"
};

export type UsageMapLetters = "R" | "F" | "T" | "C" | "E" | "X" | "Y" | "V" | "M" | "N" | "I" | "A" | "H" | "O" | "Z";
