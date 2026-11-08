/* hiddenraces.c -- optionally reveal the career races hidden by the stock game.
 * In-memory only: no profile or save file writes. Off by default.
 * Addresses/layout are for SPEED2.EXE v1.2 NA.
 */
#include "cpu.h"
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#define G_RACES 0x008383e0u
#define G_NRACES 0x008383e4u
#define G_STAGES 0x0083841cu
#define G_NSTAGES 0x00838418u
#define RACE_SIZE 0x88u
#define STAGE_SIZE 0x50u
#define RACE_HIDDEN 0x7fu
#define STAGE_CAPS 0x30u
#define STAGE_CAP 8u
static int g_enabled=-1;
static uint32_t g_applied_races, g_applied_stages;
static int setting_enabled(void){
 if(g_enabled<0){const char *v=getenv("NFSU2_SHOW_HIDDEN_RACES");g_enabled=v&&(!strcmp(v,"1")||!strcasecmp(v,"on")||!strcasecmp(v,"true")||!strcasecmp(v,"yes"));}
 return g_enabled;
}
static int committed_span(uint32_t a,uint32_t n){
 if(!a||!n||n-1u>UINT32_MAX-a)return 0;
 return mem_is_committed(a)&&mem_is_committed(a+n-1u);
}
unsigned hiddenraces_apply_tables(volatile uint8_t *races,uint32_t nr,volatile uint8_t *stages,uint32_t ns){
 unsigned changed=0;
 if(!races||!stages||nr>1024u||ns>16u)return 0;
 for(uint32_t i=0;i<nr;i++){volatile uint8_t *h=races+i*RACE_SIZE+RACE_HIDDEN;if(*h){*h=0;changed++;}}
 for(uint32_t i=0;i<ns;i++){
  for(uint32_t k=0;k<5u;k++){volatile uint8_t *cap=stages+i*STAGE_SIZE+STAGE_CAPS+k;int8_t v=(int8_t)*cap;if(v>=0&&v<(int8_t)STAGE_CAP){*cap=STAGE_CAP;changed++;}}
  /* -1 in the hidden-race cap means unlimited; preserve it. */
  volatile uint8_t *hcap=stages+i*STAGE_SIZE+0x41u;int8_t hv=(int8_t)*hcap;if(hv>=0&&hv<(int8_t)STAGE_CAP){*hcap=STAGE_CAP;changed++;}
 }
 return changed;
}
void hiddenraces_frame(void){
 if(!setting_enabled())return;
 uint32_t races=MR32(G_RACES),nr=MR32(G_NRACES),stages=MR32(G_STAGES),ns=MR32(G_NSTAGES);
 if(!races||!stages||(races==g_applied_races&&stages==g_applied_stages)||nr>1024u||ns>16u||
    !committed_span(races,nr*RACE_SIZE)||!committed_span(stages,ns*STAGE_SIZE))return;
 unsigned n=hiddenraces_apply_tables((volatile uint8_t *)(uintptr_t)races,nr,(volatile uint8_t *)(uintptr_t)stages,ns);
 g_applied_races=races;g_applied_stages=stages;
 fprintf(stderr,"[career] show hidden races: %u table entries updated (in-memory only)\n",n);
}
