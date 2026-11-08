#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include "../runtime/hiddenraces.c"
int main(void){
 uint8_t races[3*0x88]={0},stages[2*0x50]={0};
 races[0x7f]=1;races[0x88+0x7f]=1;
 stages[0x30]=1;stages[0x31]=4;stages[0x32]=8;stages[0x34]=0xff;stages[0x41]=1;
 stages[0x50+0x30]=3;stages[0x50+0x41]=0xff;
 assert(hiddenraces_apply_tables(races,3,stages,2)==6);
 assert(!races[0x7f]&&!races[0x88+0x7f]);
 assert(stages[0x30]==8&&stages[0x31]==8&&stages[0x32]==8&&stages[0x34]==0xff&&stages[0x41]==8);
 assert(stages[0x50+0x30]==8&&stages[0x50+0x41]==0xff);
 assert(hiddenraces_apply_tables(races,3,stages,2)==0);
 assert(hiddenraces_apply_tables(races,1025,stages,2)==0);
 assert(hiddenraces_apply_tables(races,3,stages,17)==0);
 puts("hidden races unit tests: all passed");
 return 0;
}
