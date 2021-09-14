/*
 * This file is part of tswow (https://github.com/tswow)
 *
 * Copyright (C) 2020 tswow <https://github.com/tswow/>
 * This program is free software: you can redistribute it and/or
 * modify it under the terms of the GNU General Public License as
 * published by the Free Software Foundation, version 3.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
import { SQL } from "wotlkdata";
import { Cell } from "wotlkdata/cell/cells/Cell";
import { MulticastCell } from "wotlkdata/cell/cells/MulticastCell";
import { PendingCell } from "wotlkdata/cell/cells/PendingCell";
import { CellSystem, LocSystem } from "wotlkdata/cell/systems/CellSystem";
import { MultiRowSystem } from "wotlkdata/cell/systems/MultiRowSystem";
import { DBC } from "wotlkdata/dbc/DBCFiles";
import { Language } from "wotlkdata/dbc/Localization";
import { LanguagesQuery, LanguagesRow } from "wotlkdata/dbc/types/Languages";
import { iterLocConstructor, loc_constructor } from "wotlkdata/primitives";
import { ClassType, resolveClassType } from "../Class/ClassType";
import { MainEntity } from "../Misc/Entity";
import { Ids } from "../Misc/Ids";
import { RaceType, resolveRaceType } from "../Race/RaceType";
import { SkillLine } from "../SkillLines/SkillLine";
import { SkillLines } from "../SkillLines/SkillLines";
import { Spell } from "../Spell/Spell";
import { SpellSkillLineAbilites, SpellSkillLineAbility } from "../Spell/SpellSkillLines";
import { std } from "../tswow-stdlib-data";

export class LanguageAutoLearn extends CellSystem<WoWLanguage> {
    add(races: RaceType[], classes: ClassType[]) {
        let classmask = 0;
        let racemask = 0;

        races.forEach(x=>{
            racemask |= (1<<(resolveRaceType(x)-1));
        })

        classes.forEach(x=>{
            classmask |= (1<<(resolveClassType(x)-1));
        })

        this.owner.Skills.forEach(x=>{
            SQL.playercreateinfo_skills.add(racemask,classmask,x.ID)
                .comment.set('tswow')
        });

        return this.owner;
    }
}

export class LanguageWords extends CellSystem<WoWLanguage> {
    add(words: string[]) {
        // word ids are never used, so their ids can just be incremented.
        let highest = DBC.LanguageWords.filter({}).sort((a,b)=>a.ID.get()>b.ID.get()?-1:1)[0].ID.get();
        for(const word of words) {
            DBC.LanguageWords.add(++highest,
                {LanguageID:this.owner.ID,Word:word});
        }
        return this.owner;
    }

    get() {
        return DBC.LanguageWords
            .filter({LanguageID:this.owner.ID})
    }

    getText() {
        return this.get().map(x=>x.Word.get());
    }
}

export class LanguageName extends LocSystem<WoWLanguage> {
    lang(lang: Language): Cell<string, WoWLanguage> & PendingCell {
        return new MulticastCell(this.owner,[
              ...this.owner.Skills.map(x=>x.Name.lang(lang))
            , ...this.owner.Spells.map(x=>x.Name.lang(lang))
            , this.owner.row.Name.lang(lang)
        ]);
    }

    get mask(): Cell<number, WoWLanguage> {
        return new MulticastCell(this.owner,[
            ...this.owner.Skills.map(x=>x.Name.mask),
            this.owner.row.Name.mask
        ]);
    }

    set(con: loc_constructor): WoWLanguage {
        iterLocConstructor(con,(lang,value)=>{
            this.lang(lang).set(value);
        });
        return this.owner;
    }
}

export class LanguageSkills extends MultiRowSystem<SkillLine,WoWLanguage> {
    protected getAllRows(): SkillLine[] {
        let skills: SkillLine[] = [];
        this.owner.Abilities.forEach((value)=>{
            let sl = value.SkillLine.get();
            if(!skills.find((x)=>x.ID == sl)) {
                skills.push(SkillLines.load(sl));
            }
        })
        return skills;
    }
    protected isDeleted(value: SkillLine): boolean {
        return value.row.isDeleted();
    }
}

export class LanguageAbilities extends MultiRowSystem<SpellSkillLineAbility,WoWLanguage> {
    protected getAllRows(): SpellSkillLineAbility[] {
        let rows: SpellSkillLineAbility[] = [];
        this.owner.Spells.forEach(x=>{
            rows = rows.concat(SpellSkillLineAbilites.getAllRows(x.SkillLines))
        });
        return rows;
    }
    protected isDeleted(value: SpellSkillLineAbility): boolean {
        return value.row.isDeleted();
    }
}
export class LanguageSpells extends MultiRowSystem<Spell,WoWLanguage>  {
    protected getAllRows(): Spell[] {
        // TODO: possible false positives
        return std.Spells.filter({Effect:39,EffectMiscValue:this.owner.ID})
    }
    protected isDeleted(value: Spell): boolean {
        return value.row.isDeleted()
    }
}

/**
 * Creates and handles languages in World of Warcraft,
 * such as Orcish or Common.
 */
export class WoWLanguage extends MainEntity<LanguagesRow> {
    constructor(row : LanguagesRow) {
        super(row);
    }

    get ID() {
        return this.row.ID.get();
    }

    get Name() {  return new LanguageName(this); }
    get Spells() { return new LanguageSpells(this); }
    get Abilities() { return new LanguageAbilities(this); }
    get Skills() { return new LanguageSkills(this); }
    get AutoLearn() { return new LanguageAutoLearn(this); }
    get Words() { return new LanguageWords(this); }
}

export const Languages = {
    create : (mod : string, id : string) => {
        const langRow = DBC.Languages.add(Ids.Language.id(mod,id));
        let sl = std.SkillLines.create(mod,id+'-skilline')
           .Category.set(10)
           .CanLink.set(0)
           .SkillCosts.set(0)
           .Icon.set('Interface\\Icons\\Trade_Engineering')
           .CanLink.set(0)
           .RaceClassInfos.modNew(
               x=>x.ClassMask.clearAll()
                   .RaceMask.set(0xffffffff)
                   .ClassMask.set(0xffffffff)
                   .Flags.clearAll()
                   .Flags.IsClassLine.mark()
                   .SkillTierID.set(0)
            )

        std.Spells.create(mod,id+'-spell')
            .Attributes.isPassive.mark()
            .Attributes.isHiddenInSpellbook.mark()
            .Proc.Chance.set(101)
            .DefenseType.set(1)
            .PreventionType.set(1)
            .Effects.addMod(effect=>{
                effect.EffectType.Language.set()
                      .LanguageID.set(langRow.ID.get())
                      .ChainAmplitude.set(1)
            })
            .SchoolMask.Physical.mark()
            .SkillLines.addMod(sl.ID,true,sla=>{
                sla.RaceMask.set(0xffffffff)
                   .AcquireMethod.set(2)
                   .ClassMask.set(0)
                   .ClassMaskForbidden.set(0)
            })
        return new WoWLanguage(langRow);
    },

    load : (id : number) => {
        return new WoWLanguage(DBC.Languages.find({ID:id}));
    },

    filter(query: LanguagesQuery) {
        return DBC.Languages.filter(query).map(x=>new WoWLanguage(x));
    }
}
